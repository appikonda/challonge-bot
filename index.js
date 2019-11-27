require('dotenv').config();

const challonge = require('challonge');
const Telegraf = require('telegraf');

const client = challonge.createClient({
  apiKey: process.env.challonge_api_key
});

const bot = new Telegraf(process.env.telegram_bot_key);
bot.start((ctx) => ctx.reply('Welcome!'));
bot.hears('/table', async (ctx) => {
  // implement me
  // step 1 - get players
  const players = await getPlayers();
  //console.log(players)
  const playerDetails = buildPlayerDetails(players);
 // console.log(playerDetails)
  // step 2 - get matches
  const matches = await getMatches();
  // step 3 - mashup info
  const table = getTable(players, matches, playerDetails);
  const formattedTable = formatTable(table);
  ctx.reply(formattedTable);
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
  //console.log(Object.keys(players));
  for(let index  of Object.keys(players)){
    const player = players[index].participant
    playerDetails[player.id] = { name: player.name, w: 0, l: 0, d: 0, ga: 0, gf: 0 };
    //console.log(playerDetails)
  }
  

  return playerDetails;
}


function getTable(players, matches, playerDetails){

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

function formatTable(table){
  let formattedTable = '';
  for( let playerId of Object.keys(table)){
    const playerDetails = table[playerId];
    formattedTable +=  [playerDetails.name, playerDetails.w, playerDetails.d, playerDetails.l, playerDetails.gf, playerDetails.ga].join('|');
    formattedTable += "\n";

  }

  return formattedTable;
}

function determineMatchoutcome(match){
  

  const outcome = { winnerId : null, loserId : null, result : '', firstPlayer : null, secondPlayer : null}
  if(match.winnerId != null){
    outcome.winnerId = match.winnerId;
    outcome.loserId = match.loserId;
    outcome.result = 'noTie';
  }else{
    console.log(match)
    outcome.firstPlayer = match.player1Id;
    outcome.secondPlayer = match.player2Id;
    outcome.result = 'tie';
  }

  return outcome;
}

function updatePlayerDetails(playerDetails, playerId, goalsFor, goalsAgainst, win, draw, loss){
  const currPlayer = playerDetails[playerId];
  //console.log(Object.keys(playerDetails), playerId);
  currPlayer.gf += goalsFor;
  currPlayer.ga += goalsAgainst;
  currPlayer.w += win;
  currPlayer.d += draw;
  currPlayer.l += loss;
}


function updateWinner(playerDetails, playerId, goalsFor, goalsAgainst){
  updatePlayerDetails(playerDetails, playerId, goalsFor, goalsAgainst, 1, 0, 0);

}

function updateLoser(playerDetails, playerId, goalsFor, goalsAgainst){
  updatePlayerDetails(playerDetails, playerId, goalsFor, goalsAgainst, 0, 0, 1);
}

function updateTiedPlayers(playerDetails, firstPlayerId, secondPlayerId, goals){
  updatePlayerDetails(playerDetails, firstPlayerId, goals, goals, 0, 1, 0);
  updatePlayerDetails(playerDetails, secondPlayerId, goals, goals, 0, 1, 0);
}
