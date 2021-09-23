const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const config = require('../config');

const utils = require('../utils')

exports.withdrawsOnCreate = functions.firestore
  .document('withdraws/{withdrawId}')
  .onCreate((snap, context) => {
    console.log('******** - withdrawsOnCreate begin - ********');

    var userId = snap.data().createdBy;
    return admin
      .firestore()
      .collection('users')
      .doc(userId)
      .get()
      .then(doc => {
        var user = doc.data();
        var amount = 0;
      
        if (user.balance) {
          amount = user.balance;
          user.balance = 0;
        }

        var new_withdraw = {
          timestamp: new Date().getTime(),
          amount:'BTC ' + amount
        };

        console.log('reset user balance : %O', user);
        doc.ref.update(user);

        console.log('update withdraw fields: %O', new_withdraw);
        console.log('******** - withdrawsOnCreate end - ********');

         var emailContent = new_withdraw;
        emailContent.userId = userId;
        utils.sendEmail('new withdraw is created!', JSON.stringify(emailContent));


        return snap.ref.update(new_withdraw)
      })
      .catch(error => {
        console.log('******** - withdrawsOnCreate end with error: %O- ********', error);
        return false
      })
  })
