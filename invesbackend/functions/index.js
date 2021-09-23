const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp(functions.config().firebase);

const users = require('./src/users');
const deposits = require('./src/deposits');
const orders = require('./src/orders');

exports.addUser = users.addUser;
exports.addDeposit = deposits.addDeposit;
exports.addOrder = orders.addOrder;

exports.depositsOnCreate = deposits.depositsOnCreate;
exports.usersOnCreate = users.usersOnCreate;
exports.ordersOnCreate = orders.ordersOnCreate;


console.log('Server deployed');