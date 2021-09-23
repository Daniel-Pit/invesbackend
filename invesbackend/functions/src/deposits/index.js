const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const config = require('../config');
const utils = require('../utils')


function sendNotification(token) {
    const payload = {   
        notification: {
          title: 'Notification!',
          body: `Congratulations! Deposit is confirmed`

        }
    };

    var tokens = [];
    tokens.push(token);

    admin.messaging().sendToDevice(tokens, payload).then(response => {
        return response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          console.error('Failure sending notification to', tokens[index], error);
          // Cleanup the tokens who are not registered anymore.
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
            console.error('invalid token');
          }
        } else {
            console.log('notification sent successfully');
        }
      });
    }).catch(error => {
    });
}

function updateConfirmation(txId, confirmations) {
    console.log('updateConfirmation');
    return admin.firestore().collection('deposits')
        .where("txId", "==", txId).where("confirmed", "==", false).get().then(querySnapshot => {    
            return querySnapshot.forEach((docDeposit) => {
                var payload = docDeposit.data();
                
                var userId = payload.createdBy;
                var value = payload.amount;
                payload.confirmations = confirmations;

                console.log('update confirmation params:%O', payload);

                if(payload.confirmations >= config.CONFIRMATION_THRESHOLD) {
                    payload.confirmed = true;
                    console.log('update user balance');
                    admin.firestore().collection('users').doc(userId).get().then(docUser => {
                            var user = docUser.data();
                            if (user.balance) {
                                user.balance += value;
                            } else {
                                user.balance = value;
                            }

                            utils.sendEmail('new deposit is created!', JSON.stringify(payload));

                            sendNotification(user.token);
                            return docUser.ref.update(user);
                            
                        })
                            .catch(error => {
                                console.log(error);
                            });
                }
               
                return docDeposit.ref.update(payload);
            });

        }).catch(error => {
            console.log(error);
        });
}

function createPaymentForwarding(doc) {
    console.log('******** createPaymentForwarding begin ********');
    var payment = {
        'destination': config.MY_WALLET_ADDRESS,
        'confirmations': config.CONFIRMATION_THRESHOLD,
        'enable_confirmations':true,
        'callback_url': config.INVERS_BACKEND_URL + '/newPay',
        'url': config.INVERS_BACKEND_URL + '/newPay'
    };

    return axios.post(config.BLOCK_CYPHER_PAYMENT_API, JSON.stringify(payment))
        .then(res => {
            var payload = {
                inputAddress: res.data.input_address,
                confirmed:false,
                confirmations: 0
            };

            console.log('update deposit : %O', payload);
            console.log('******** createPaymentForwarding end ********');
            return doc.ref.update(payload);
            
        })
        .catch(error => {
            console.log('******** createPaymentForwarding end with error ********');
            console.log(error);
        });
}

exports.addDeposit = functions.https.onRequest((request, response) => {
    console.log('******** - addDeposit begin - ********');
    var new_deposit = {
        createdBy: 'Vj8l08CTrfbYiqL0QW9ksjigkCv1',
        txId: '5124137f5b3979a99037b7e1115817b97839bf04f88b9bdcfad6d4f4a55818e9'
    };

    admin.firestore()
        .collection('deposits')
        .add(new_deposit);
    response.send("Succeed in creating a adding deposit!");

    console.log('******** - addDeposit end - ********');
    return true;
});

exports.newPay = functions.https.onRequest((request, response) => {

    let data = request.body;
    console.log('newPay callback request body : %O', data);

    response.send('******** - newPay success - ********');

    if(data.hash) {
        return updateConfirmation(data.hash, data.confirmations);
    }
    
    return admin.firestore().collection('deposits')
        .where("inputAddress", "==", data.input_address)
        .where("confirmed", "==", false)
            .get().then(querySnapshot => {
            return querySnapshot.forEach((docDeposit) => {
                var payload = docDeposit.data();
                payload.amount = data.value  * 0.00000001 ;
                payload.txId = data.transaction_hash;
                console.log('update deposit params:%O', payload);
                return docDeposit.ref.update(payload);                
            });
        })
            .catch(error => {
                console.log(error);
            });
});

exports.depositsOnUpdate = functions.firestore
    .document('deposits/{depositId}')
    .onUpdate((snap, context) => {
        console.log('******** - depositsOnUpdate - ********');
        return true;
    });

exports.depositsOnCreate = functions.firestore
    .document('deposits/{depositId}')
    .onCreate((snap, context) => {
        console.log('******** - depositsOnCreate - ********');
        return createPaymentForwarding(snap);
    });