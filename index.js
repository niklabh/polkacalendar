const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { extractTime } = require('@polkadot/util');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), listEvents);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

const ARCHIVE_NODE_ENDPOINT = "wss://kusama-rpc.polkadot.io/";


/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});

  const provider = new WsProvider(ARCHIVE_NODE_ENDPOINT);

  const api = await ApiPromise.create({ provider });

  const bestNumber = await api.derive.chain.bestNumber();

  const referendums = await api.derive.democracy.referendums();

  const blockTime = api.consts.babe.expectedBlockTime;

  referendums.forEach(referendum => {
    const { index, image, status } = referendum;

    const enactBlock = status.end.add(status.delay).sub(bestNumber);
    const remainBlock = status.end.sub(bestNumber).subn(1);

    console.log(index.toNumber());
    console.log(image.proposal.method, image.proposal.methodName);

    console.log(new Date(Date.now() + blockTime.mul(remainBlock).toNumber()));
    console.log(new Date(Date.now() + blockTime.mul(enactBlock).toNumber()))

    var event = {
      'summary': `Referendum #${index.toNumber()} ends`,
      'description': `Referendum #${index.toNumber()} ${image.proposal.method} ends`,
      'start': {
        'dateTime': new Date(Date.now() + blockTime.mul(remainBlock).toNumber()),
        'timeZone': 'Asia/Kolkata',
      },
      'end': {
        'dateTime': new Date(Date.now() + blockTime.mul(remainBlock).toNumber() + 60 * 60 * 1000),
        'timeZone': 'Asia/Kolkata',
      }
    };

    console.log(event);

    calendar.events.insert({
      auth: auth,
      calendarId: 'primary',
      resource: event,
    }, function(err, event) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        return;
      }
      console.log('Event created: %s', event.htmlLink);
    });

    event = {
      'summary': `Referendum #${index.toNumber()} activate`,
      'description': `Referendum #${index.toNumber()} ${image.proposal.method} activate`,
      'start': {
        'dateTime': new Date(Date.now() + blockTime.mul(enactBlock).toNumber()),
        'timeZone': 'Asia/Kolkata',
      },
      'end': {
        'dateTime': new Date(Date.now() + blockTime.mul(enactBlock).toNumber() + 60 * 60 * 1000),
        'timeZone': 'Asia/Kolkata',
      }
    };

    calendar.events.insert({
      auth: auth,
      calendarId: 'primary',
      resource: event,
    }, function(err, event) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        return;
      }
      console.log('Event created: %s', event.htmlLink);
    });

  });

}



