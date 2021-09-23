const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const config = require('../config');

setInterval(() => {
    getPaymentsFromMiners();
}, 1000 * 30);

setInterval(() => {
    confirmPayment();
}, 1000 * 30);

getPaymentsFromMiners();
confirmPayment();

function updateShapeShift(shapeshiftPayment) {
    admin.firestore().collection('shapeshiftPayments')
    .where("confirmed", "==", false)
    .where("txId", "==", shapeshiftPayment.inputTXID)
    .get().then(querySnapshot => {
        querySnapshot.forEach( (doc) => {
            let payment = doc.data();
            payment.confirmed = true;
            doc.ref.update(payment);
        });
        return true;
    }).catch(error => {

    });
}

function confirmPayment() {
    console.log('confirmPayment');
    axios.get(config.SHAPE_SHIFT_API + '/txbyapikey/' + config.SHAPE_SHIFT_PRIVATE_KEY).then(shapeshift => {
                            console.log('shape shift data: %O ', shapeshift.data);

                            if(shapeshift.data.length > 0) {
                                var shapeshiftPayment = shapeshift.data[0];
                                if(shapeshiftPayment.status ==='complete') 
                                    updateShapeShift(shapeshiftPayment);
                            }
                            return true;    
                        })
                            .catch(err => {
                                console.log(err);
                            });

    admin.firestore().collection('minerspayment').where("confirmed", "==", false).get().then(querySnapshot => {
        querySnapshot.forEach((docMinerPayment) => {
            let payment = docMinerPayment.data();
            var userId = payment.createdBy;

            console.log('unconfirmed payment: %O', payment);

            axios.get(config.BLOCK_CYPHER_API + '/eth/main/txs/' + payment.txId).then(res => {

                if (res.data.confirmations >= config.CONFIRMATION_THRESHOLD) {
                    payment.confirmed = true;
                    docMinerPayment.ref.update(payment);

                    admin.firestore().collection('users').doc(userId).get().then(docUser => {
                        var user = docUser.data();
                        var params = {
                            withdrawal: config.MY_WALLET_ADDRESS,
                            pair: 'eth_btc',
                            returnAddress: user.ethAddress,
                            apiKey:config.SHAPE_SHIFT_PUBLIC_KEY
                        };
                        console.log('shapeshift params: %O', params);
                        axios.post(config.SHAPE_SHIFT_API + '/shift', params).then(shapeshift => {
                            console.log('created shape shift payment: %O ', shapeshift.data);

                            var new_shapeshift_payment = {
                                ethAddress: user.ethAddress,
                                createdBy: userId,
                                amount: payment.amount/1000000000,
                                txId: payment.txId,
                                depositAddress: config.MY_WALLET_ADDRESS,
                                confirmed: false,
                                timestamp: payment.timestamp
                            };

                            console.log('new shapeshift payment : %O', new_shapeshift_payment);

                            admin.firestore().collection('shapeshiftPayments').add(new_shapeshift_payment);
                            return true;
                        })
                            .catch(err => {
                                console.log(err);
                            });
                        return true;
                    }).catch(error => {
                        console.log('create shapeshift error:%O', error);
                    });

                }
                return true;
            }).catch(error => {
                console.log(error);
            });
        });
        return true;
    })
        .catch(error => {
            console.log(error);
        });


}

function getPaymentsFromMiners() {
    admin.firestore().collection('minerspayment').orderBy("timestamp", "desc").limit(1).get().then(querySnapshot => {
        var last_payment_timestamp = 0;

        if (querySnapshot.size === 0) {
            checkMinersPayment(last_payment_timestamp);
        }
        else {
            querySnapshot.forEach((docMinerPayment) => {
                var last_payment = docMinerPayment.data();
                console.log('last minerspayment: %O', last_payment);
                last_payment_timestamp = last_payment.timestamp;
                checkMinersPayment(last_payment_timestamp);

            });
        }
        return true;
    })
        .catch(error => {
            console.log(error);
        });
}

function updateUserBalance(amount, userId) {
    var params = {
        fsym:'ETH',
        tsyms:'BTC'
    };

    axios.get(config.CRYPTO_COMPARE_API,  {params:params}).then(res => {
        console.log('crypto compare response: %O', res.data);
        var btc_amount = amount * res.data.BTC;
        console.log('Btc amount to add balance:%O', btc_amount);
        return admin.firestore().collection('users').doc(userId).get().then(docUser => {
                            var user = docUser.data();
                            if (user!==undefined && user.balance) {
                                user.balance += btc_amount;
                            }   
                            return docUser.ref.update(user);
                        }).catch(error => {
                            console.log(error);
                        });

    }).catch(error => {
        console.log(error);
    });
}

function updateUserRewards(userId) {
    return admin.firestore().collection('users').doc(userId).get().then(docUser => {
                            var user = docUser.data();
                            if (user.rewards) {
                                user.rewards += 1;
                            } else
                                user.rewards = 1;

                            if(user.token) {
                                sendNotification(user.token);
                            }
                            return docUser.ref.update(user);
                        }).catch(error => {
                            console.log(error);
                        });
}

function addRewards(amount, userId) {
    var params = {
        fsym:'ETH',
        tsyms:'BTC'
    };

    axios.get(config.CRYPTO_COMPARE_API,  {params:params}).then(res => {
        var btc_amount = amount * res.data.BTC;
        console.log('Btc amount to add balance:%O', btc_amount);

        var new_reward = {
            timestamp: Date.now(),
            amount: btc_amount,
            userId: userId
        };

        return admin.firestore()
        .collection('rewards')
        .add(new_reward);

    }).catch(error => {
        console.log(error);
    });   
}

function addMinerPayment(new_minerspayment){
    var params = {
        fsym:'ETH',
        tsyms:'BTC'
    };

    axios.get(config.CRYPTO_COMPARE_API,  {params:params}).then(res => {
        var btc_amount = new_minerspayment.amount * res.data.BTC;
        new_minerspayment.amount = btc_amount;
        console.log('new miners payment added: %O', new_minerspayment);
        return admin.firestore().collection('minerspayment').add(new_minerspayment);

    }).catch(error => {
        console.log(error);
    });                                                
}

function sendNotification(token) {
    const payload = {   
        notification: {
          title: 'Notification!',
          body: `Congratulations! You just won a reward!`

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
// sendNotification('eyvhViABYnU:APA91bEkj3KfelTqb3YxEItWf5YqytDQhYfSfdBpEPE5Ev-RLD5-7t5T1RIUQgBC_qZrrhtmmbUIXwiNzgqIJc24oZJWiTfuscU4uNVS-VVGCbcwzy-rpPu0nirBW77JdIUjj4D-eD64-K1xJJwPdh-cUxnfPMobtg');


function checkMinersPayment(last_payment_timestamp) {
    console.log('******* checkMinersPayment begin ********');

    axios.get(config.TWO_MINERS_API + '/payments').then(res => {
        var payments = res.data.payments;

        payments.forEach((payment) => {
            if (payment.timestamp > last_payment_timestamp) {
                admin.firestore().collection('users').where("ethAddress", "==", payment.address).get().then(querySnapshot => {
                    
                    querySnapshot.forEach((docUser) => {
                        console.log('payment from miners arrived: %O', payment);

                        var userId = docUser.id;
                        console.log('addminers payment :%O', userId);

                        updateUserBalance(payment.amount/1000000000, userId);

                            var user = docUser.data();
                            if (user.rewards) {
                                user.rewards += 1;
                            } else
                                user.rewards = 1;
                            docUser.ref.update(user);

                            if(user.token) {
                                sendNotification(user.token);
                            }

                            addRewards(payment.amount/1000000000, userId);

                            var new_minerspayment = {
                                ethAddress: user.ethAddress,
                                isBundledOrder:false,
                                createdBy: userId,
                                amount: payment.amount/1000000000,
                                txId: payment.tx,
                                confirmed: false,
                                timestamp: payment.timestamp
                            };

                            addMinerPayment(new_minerspayment);


                    });

                    return true;
                })
                    .catch(error => {

                    });

                admin.firestore().collection('bundledOrder').where("ethAddress", "==", payment.address).get().then(querySnapshot => {
                    
                    querySnapshot.forEach((docBundledOrder) => {
                        console.log('payment from miners arrived: %O', payment);

                        var bundledOrderId = docBundledOrder.id;

                        console.log('addminers payment :%O', bundledOrderId);

                        admin.firestore().collection('bundledOrder').doc(bundledOrderId).collection('participants').get().then(participants => {
                            var total_amount = 0;
                            participants.forEach((docParticipant) => { 
                              console.log('participant:%O', docParticipant.data());
                              var participant = docParticipant.data();
                              if(participant.amount) {
                                total_amount += parseFloat(participant.amount);
                              }
                            });

                            
                            participants.forEach((docParticipant) => {
                              console.log('participant id:%O', docParticipant.id);
                              var participant = docParticipant.data();
                              if(participant.amount) {
                                var ratio = participant.amount/total_amount;
                                console.log('ratio : %f', ratio);
                                updateUserBalance(ratio*payment.amount/1000000000, docParticipant.id);
                                updateUserRewards(docParticipant.id);
                                addRewards(payment.amount/1000000000, docParticipant.id);
                              }
                            });

                            return true;
                        }).catch(error => {
                            console.log(error);
                        });

                        var new_minerspayment = {
                            ethAddress: payment.address,
                            isBundledOrder:true,
                            amount: payment.amount/1000000000,
                            txId: payment.tx,
                            confirmed: false,
                            timestamp: payment.timestamp
                        };

                        addMinerPayment(new_minerspayment);
                    });

                    return true;
                    })
                    .catch(error => {

                    });
            }
        });

        console.log('******* checkMinersPayment end ********');
        return true;
    }).catch(error => {
        console.log(error);
    });
}