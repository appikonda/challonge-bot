require('dotenv').config();

const _ = require('lodash');
const express = require('express');
const expressApp = express();

const challonge = require('challonge');
const Telegraf = require('telegraf');

const API_TOKEN = process.env.telegram_bot_key;
const PORT = process.env.PORT 
const URL = process.env.URL 

const client = challonge.createClient({
  apiKey: process.env.challonge_api_key
});

const bot = new Telegraf(API_TOKEN);

bot.start((ctx) => ctx.reply('Welcome!'));
bot.hears('/table', async (ctx) => {
  // implement me
  // step 1 - get players
  const players = await getPlayers();
  const playerDetails = buildPlayerDetails(players);
  // step 2 - get matches
  const matches = await getMatches();
  // step 3 - mashup info
  const table = getTable(matches, playerDetails);
  const sortedTable = sortTable(table);
  const longestNameLength = findLongestNameLength(sortedTable);
  const formattedTable = formatTable(sortedTable, longestNameLength);
  ctx.replyWithMarkdown(formattedTable);
});
bot.launch();

async function getPlayers() {
  return new Promise((resolve, reject) => {
    client.participants.index({
      id: process.env.tournament_id,
      callback: (err, players) => {
        if (err) {
          reject(err);
        } else {
          resolve(players);
        }
      }
    });
  });
}

async function getMatches() {
  return new Promise((resolve, reject) => { 
    client.matches.index({
      id: process.env.tournament_id,
      callback: function(error, matches){
        if(error){
          reject(error)
        }else{
          resolve(matches)
        }

      }
    });


  });
  
}

function buildPlayerDetails(players){
  const playerDetails = {};
  for(let index  of Object.keys(players)){
    const player = players[index].participant
    playerDetails[player.id] = { name: player.name.split('(')[0], w: 0, l: 0, d: 0, ga: 0, gf: 0, gd: 0, pts: 0 };
  }
  

  return playerDetails;
}


function getTable( matches, playerDetails){
  for (let index of Object.keys(matches)){
    const match = matches[index].match;
    if(match.state == 'complete'){
      const outcome = determineMatchoutcome(match)
      let [firstPlayerGoals, secondPlayerGoals] = match.scoresCsv.split('-');
      firstPlayerGoals = parseInt(firstPlayerGoals,10);
      secondPlayerGoals = parseInt(secondPlayerGoals,10);
      if(outcome.result === 'noTie'){
        const winningGoals =  Math.max(firstPlayerGoals, secondPlayerGoals);
        const losingGoals =  Math.min(firstPlayerGoals, secondPlayerGoals);
        updateWinner(playerDetails, outcome.winnerId, winningGoals, losingGoals)
        updateLoser(playerDetails, outcome.loserId, losingGoals, winningGoals)
      }else{
        updateTiedPlayers(playerDetails, outcome.firstPlayer, outcome.secondPlayer, firstPlayerGoals)
      }
    }
  }
  return playerDetails;
}

function formatTable(sortedTable, longestNameLength){
  const scoreLength = 2;
 
  let formattedTable = '```';
  formattedTable += '|  player  |w-d-l|gf|ga|pt|gd|';
  formattedTable += "\n";
  formattedTable += '---------------------------';
  formattedTable += "\n";
  sortedTable.forEach((playerDetails)=>{
    formattedTable += '|';
    formattedTable +=  [playerDetails.name.padEnd(longestNameLength,' '), playerDetails.w+'-'+playerDetails.d+'-'+playerDetails.l, padInt(playerDetails.gf), padInt(playerDetails.ga), padInt(playerDetails.pts), playerDetails.gd].join('|');
    formattedTable += '|';
    formattedTable += "\n";
  });
  formattedTable += '```';
  return formattedTable;
}

function determineMatchoutcome(match){
  

  const outcome = { winnerId : null, loserId : null, result : '', firstPlayer : null, secondPlayer : null}
  if(match.winnerId != null){
    outcome.winnerId = match.winnerId;
    outcome.loserId = match.loserId;
    outcome.result = 'noTie';
  }else{
    outcome.firstPlayer = match.player1Id;
    outcome.secondPlayer = match.player2Id;
    outcome.result = 'tie';
  }

  return outcome;
}

function updatePlayerDetails(playerDetails, playerId, goalsFor, goalsAgainst, win, draw, loss, goalsDiff, points){
  const currPlayer = playerDetails[playerId];
  currPlayer.gf += goalsFor;
  currPlayer.ga += goalsAgainst;
  currPlayer.w += win;
  currPlayer.d += draw;
  currPlayer.l += loss;
  currPlayer.gd += goalsDiff;
  currPlayer.pts += points;
}


function updateWinner(playerDetails, playerId, goalsFor, goalsAgainst){
  updatePlayerDetails(playerDetails, playerId, goalsFor, goalsAgainst, 1, 0, 0, (goalsFor-goalsAgainst), 3);

}

function updateLoser(playerDetails, playerId, goalsFor, goalsAgainst){
  updatePlayerDetails(playerDetails, playerId, goalsFor, goalsAgainst, 0, 0, 1, (goalsFor-goalsAgainst), 0);
}

function updateTiedPlayers(playerDetails, firstPlayerId, secondPlayerId, goals){
  updatePlayerDetails(playerDetails, firstPlayerId, goals, goals, 0, 1, 0, 0, 1);
  updatePlayerDetails(playerDetails, secondPlayerId, goals, goals, 0, 1, 0, 0, 1);
}

function sortTable(table){
  let tableValues =Object.values(table)
  console.log(tableValues)
  let sortedTable = _.orderBy(tableValues, ['pts', 'gd'], ['desc', 'desc'] ) 
  console.log(sortedTable)
  return sortedTable;

}

function findLongestNameLength(playerDetails){
  let longest = 0; 
  playerDetails.forEach((player) => {
    longest =Math.max(player.name.length, longest);
  })
  return longest;

}

function padInt(number) {
  return (number < 10 ? '0' : '') + number
}


// and at the end just start server on PORT
expressApp.get('/', (req, res) => {
  res.send('Hello World!');
});
expressApp.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
