require('dotenv').config();

const challonge = require('challonge');
const Telegraf = require('telegraf');

const client = challonge.createClient({
    apiKey: process.env.challonge_api_key
});

let statsMap = new Map();
function getPlayer(callback) {
    client.participants.index({
        id: process.env.tournament_id,
        callback
    });
}
getPlayer((err, data) => {
    if (data) {
        let playerKeys = Object.keys(data);
        playerKeys.map(key => {
            let playerInfomation = data[key].participant
            // create player details
            let playerDetails = {
                name: playerInfomation.name,
                goalsFor: 0,
                goalsAgainst: 0,
                won: 0,
                lost: 0,
                draw: 0
            };
            statsMap.set(playerInfomation.id, playerDetails);
        });
        // Get match information
        client.matches.index({
            id: process.env.tournament_id,
            callback: (err, matchData) => {                
                if (matchData) {
                    let matches = Object.keys(matchData);
                    matches.map(key => {
                        let matchInfo = matchData[key].match;

                        if (matchInfo.state == 'complete') {
                            let player1Id = matchInfo.player1Id;
                            let player2Id = matchInfo.player2Id;
                            let score = matchInfo.scoresCsv.split("-");
                            let player1score = score[0];
                            let player2score = score[1];
                          // console.log(typeof (matchInfo.winnerId) + '' + matchInfo.winnerId)
                           // console.log(typeof (player1Id) + '' + player1Id)

                            switch (matchInfo.winnerId) {
                                case player1Id:
                                    //update player1  details - winner
                                    updatePlayerDetails(player1Id, player1score, player2score, 1, 0, 0);
                                    //update player2  details - loser
                                    updatePlayerDetails(player2Id, player2score, player1score, 0, 1, 0);

                                    break
                                case player2Id:
                                    //update player1  details - winner
                                    updatePlayerDetails(player2Id, player2score, player1score, 1, 0, 0);

                                    //update player2  details - loser
                                    updatePlayerDetails(player1Id, player1score, player2score, 0, 1, 0);

                                    break;

                                default:
                                    //update player1  details - draw
                                    updatePlayerDetails(player1Id, player1score, player2score, 0, 0, 1);
                                    //update player2  details - draw
                                    updatePlayerDetails(player2Id, player2score, player1score, 0, 0, 1);



                            } // end of switch


                        }

                    })
                    var table = '<b>Standings</b>\n------------------------------\n   Name  | GF | GA | W | L | D |    \n--------------------------------\n';

                    for (let pid of statsMap.keys()) {
                        let playerinfo = statsMap.get(pid);
                        table += (playerinfo.name.slice(0, 8) + ' | ' + (playerinfo.goalsFor) + ' | ' + parseInt(playerinfo.goalsAgainst) + ' | ' + playerinfo.won + ' | ' + playerinfo.lost + ' | ' + playerinfo.draw)
                        table += ('\n')
                    }
                    //telegram call
                    const bot = new Telegraf(process.env.telegram_bot_key);
                    bot.start((ctx) => ctx.replyWithHTML(HTML))
                    bot.hears('/table', (ctx) => ctx.replyWithHTML(table))
                    bot.launch()

                }

            }
        }); // Matches Clinet

    }
}); // get player


function updatePlayerDetails(pid, gs, ga, w, l, d) {
    let player = statsMap.get(pid);
    statsMap.get(pid).goalsFor = Number(player.goalsFor) + Number(gs);
    statsMap.get(pid).goalsAgainst = Number(player.goalsAgainst) + Number(ga);
    statsMap.get(pid).won = player.won + w;
    statsMap.get(pid).lost = player.lost + l;
    statsMap.get(pid).draw = player.draw + d;
  //  console.log(statsMap.get(pid))
}