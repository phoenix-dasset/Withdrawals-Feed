var ws = require('ws');
var ws = new ws("wss://api.dassetx.com/WSGateway/");
var _ = require('lodash');
var CronJob = require('cron').CronJob;
var Botkit = require('botkit');
var config = require('./config.json');
var withdrawals = [];
var counter = 0;
if (!config.CLIENT_ID || !config.CLIENT_SECRET || !config.PORT || !config.VERIFICATION_TOKEN) {
	console.log('Error: Specify CLIENT_ID, CLIENT_SECRET, VERIFICATION_TOKEN and PORT in environment');
	process.exit(1);
}
var configBot = {};
if (process.env.MONGOLAB_URI) {
	var BotkitStorage = require('botkit-storage-mongo');
	configBot = {
		storage: BotkitStorage({ mongoUri: process.env.MONGOLAB_URI }),
	};
}
var controller = Botkit.slackbot(configBot).configureSlackApp({
	clientId: config.CLIENT_ID,
	clientSecret: config.CLIENT_SECRET,
	verificationToken: config.VERIFICATION_TOKEN,
	scopes: ['commands'],
});

controller.setupWebserver(config.PORT, function (err, webserver) {
	controller.createWebhookEndpoints(controller.webserver);
	controller.createOauthEndpoints(controller.webserver, function (err, req, res) {
		if (err) {
			res.status(500).send('ERROR: ' + err);
		}
		else {
			res.send('Success!');
		}
	});
});
var bot = controller.spawn({
	incoming_webhook: {
		url: config.URL
	}
});
ws.onopen = function(){
	authenticate();
	fetchNewTickets();
	fetchProcessingTickets();
	function authenticate(){
		var authenticate = {
			"m": 0,
			"i": 0,
			"n": "WebAuthenticateUser",
			"o": ""
		};
		var authenticatePayload = {
			"UserName": config.USERNAME,
			"Password": config.PASSWORD
		};
		authenticate.o = JSON.stringify(authenticatePayload);
		ws.send(JSON.stringify(authenticate));
	}
	function fetchProcessingTickets(){
		var pendingTickets = {
			"m": 0,
			"i": 0,
			"n": "GetAllWithdrawTickets",
			"o": ""
		};
		var pendingPayload = {
			"OMSId": 1,
			"Operatorid": 1,
			"Status": "AdminProcessing",
		};
		pendingTickets.o = JSON.stringify(pendingPayload);
		ws.send(JSON.stringify(pendingTickets));
	}
	function fetchNewTickets(){
		var newTickets = {
			"m": 0,
			"i": 0,
			"n": "GetAllWithdrawTickets",
			"o": ""
		};
		var newPayload = {
			"OMSId": 1,
			"Operatorid": 1,
			"Status": "New"
	
		};
		newTickets.o = JSON.stringify(newPayload);
		ws.send(JSON.stringify(newTickets));
	}
}
ws.onmessage = function (evt) {
	var frame = JSON.parse(evt.data);
	if (frame.n == 'GetAllWithdrawTickets'){
		frame = JSON.parse(frame.o);
		withdrawals.push(frame);
		console.log(frame);
		counter++
		if (counter == 2) {
			post(constructString(withdrawals));
		}
	}
}
function post(cur){
	bot.sendWebhook({
		text: cur,
		channel: '#api-tests',
	}, function (err, res) {
		if (err) {
			// ...
		}
	});
}

function constructString(dump) {
	var combine = [];
	for(i = 0; i < 2; i++){
		for(j = 0; j < dump[i].length; j++){
			if(dump[i][j].AssetName == "New Zealand Dollar"){
				combine.push(dump[i][j]);
			}
		}
	}
	var string = "There are  " + combine.length + " new withdrawals";
	return string
}

const cronJob = new CronJob(
	'00 00 23 * * *',
	main,
	console.log('Job completed: ' + new Date()),
	true)

cronJob.start()
console.log('CronJob Status:', cronJob.running);
