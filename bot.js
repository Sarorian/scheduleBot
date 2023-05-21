require('dotenv').config();

const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const { parse, format, isValid, parseISO, differenceInMilliseconds } = require('date-fns');
const eventFile = 'events.json';

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  scheduleEventReminders();
});

client.on('messageCreate', (message) => {

  if (message.author.bot) return;

  if (message.content.startsWith('!event')) {
    const regex = /^!event\s+(.+),\s+(.+)$/i;
    const match = message.content.match(regex);

    if (!match) {
      message.channel.send('Invalid command format. Please use `!event (name), (date and time)`.');
      return;
    }

    const eventName = match[1].trim();
    const eventDateTime = match[2].trim();

    if (!eventName || !eventDateTime) {
      message.channel.send('Please provide both the event name and date/time.');
      return;
    }

    const eventDate = parse(eventDateTime, 'M/d/yyyy h:mma', new Date());

    if (!isValid(eventDate)) {
      message.channel.send('Invalid date/time format. Please use a valid date and time format.');
      return;
    }

    const eventData = {
      name: eventName,
      date: format(eventDate, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      messageSent: false
    };

    fs.readFile(eventFile, 'utf-8', (err, data) => {
      if (err) {
        console.error(err);
        message.channel.send('An error occurred while reading the events file.');
        return;
      }

      let events = [];

      try {
        events = JSON.parse(data);
      } catch (err) {
        console.error(err);
        message.channel.send('An error occurred while parsing the events data.');
        return;
      }

      events.push(eventData);

      fs.writeFile(eventFile, JSON.stringify(events), 'utf-8', (err) => {
        if (err) {
          console.error(err);
          message.channel.send('An error occurred while adding the event.');
          return;
        }

        console.log(`Event "${eventName}" added successfully.`);
        message.channel.send(`Event "${eventName}" added successfully.`);
      });
    });
  } else if (message.content === '!schedule') {
    fs.readFile(eventFile, 'utf-8', (err, data) => {
      if (err) {
        console.error(err);
        message.channel.send('An error occurred while reading the events file.');
        return;
      }

      let events = [];

      try {
        events = JSON.parse(data);
      } catch (err) {
        console.error(err);
        message.channel.send('An error occurred while parsing the events data.');
        return;
      }

      if (events.length > 0) {
        events.sort((a, b) => {
          const dateA = parseISO(a.date);
          const dateB = parseISO(b.date);
          return differenceInMilliseconds(dateA, dateB);
        });
      
        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('Scheduled Events')
          events.forEach((event) => {
            const eventDate = parseISO(event.date);
            const formattedDate = format(eventDate, 'EEEE, MMMM do h:mma');
            embed.addFields({ name: event.name, value: formattedDate})
          });

        console.log('Sending schedule message:');
        console.log(embed);
      
        message.channel.send({ embeds: [embed] });
      } else {
        message.channel.send('You have no events scheduled.');
      }
    });
  } else if (message.content === '!test') {
    message.reply({
      content: 'THIS SHITS ON YO',
  })
    console.log("working");
  }
});

client.login(process.env.DISCORD_BOT_ID);

function updateEventInFile(events) {
  fs.writeFile(eventFile, JSON.stringify(events), 'utf-8', (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log('Event data updated successfully.');
    }
  });
}

function scheduleEventReminders() {
  console.log("started event reminder checker");
  setInterval(() => {
    fs.readFile(eventFile, 'utf-8', (err, data) => {
      if (err) {
        console.error(err);
        return;
      }

      let events = [];

      try {
        events = JSON.parse(data);
      } catch (err) {
        console.error(err);
        return;
      }

      const currentTime = new Date();
      currentTime.setHours(currentTime.getHours() - 6); //Handle the offset from the server
      events.forEach((event) => {
        const eventDate = parseISO(event.date);
        const timeUntilEvent = differenceInMilliseconds(eventDate, currentTime);

        if (timeUntilEvent > 0 && timeUntilEvent <= 3600000 && !event.messageSent) {
          setTimeout(async () => {
            console.log("Attempting to send DM for event: " + event.name);
            try {
              const user = await client.users.fetch('235945490884067328');
              if (user) {
                await user.send(`Event Reminder: ${event.name} is happening in 1 hour!`);
                event.messageSent = true;
                console.log("DM sent for " + event.name + " event");
                updateEventInFile(events);
              }
            } catch (error) {
              console.error(`Error sending DM to user: ${error}`);
              console.error(error);
            }
          }, timeUntilEvent - Date.now());
        } else if (timeUntilEvent === 0 || timeUntilEvent < 0) {
          const eventIndex = events.indexOf(event);
          if (eventIndex > -1) {
            events.splice(eventIndex, 1);
            console.log(`Event "${event.name}" has passed and has been removed.`);
            updateEventInFile(events);
          }
        }
      });
    });
  }, 60000); // Check every minute (60000 milliseconds)
}