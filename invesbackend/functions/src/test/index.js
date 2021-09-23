const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const config = require('../config');

const BCY_WALLET_ADDRESS = 'C2zxrpvekDDFjk1yQ9c8K1JXUNLQmiyNCi';
// https://live.blockcypher.com/bcy/address/C2zxrpvekDDFjk1yQ9c8K1JXUNLQmiyNCi/

exports.addUserTest = functions.https.onRequest((request, response) => {
    console.log('******** - addUser begin - ********');
    axios.post(config.BLOCKCYPER_BCY_API)
        .then(res => {
            console.log(res.data);
            var new_user = {
                bcyPrivateKey: res.data.private,
                bcyPublicKey: res.data.public,
                bcyAddress: res.data.address,
                created: Date.now(),
                balance:0,
                rewards:0
            };

            console.log('private key : %s', new_user.bcyPrivateKey);
            console.log('public key : %s', new_user.bcyPublicKey);
            console.log('wallet address : %s', new_user.bcyAddress);
            admin.firestore()
                .collection('tusers')
                .add(new_user);

            facuetFund(new_user.bcyAddress);
            
            response.send("Succeed in creating a new user!");
            console.log('******** - addUser end - ********');
            return true;
        })
        .catch(error => {
            console.log(error);
            response.send("Failed to create a new user!");
            console.log('******** - addUser end - ********');
            return false;
        });
});

function facuetFund(address) {
    var data = {
        address:address,
        amount:100000
    }
    axios.post('https://api.blockcypher.com/v1/bcy/test/faucet?token=cb503aaeed0d4817b286ab896d68b0a7', JSON.stringify(data) )
    .then( res =>{
        console.log(res.data);

        return true;
    }).catch(error => {

    });
}

exports.inputMoneyTest = functions.https.onRequest((request, response) => {
    console.log('******** - inputMoneyTest begin - ********');

    facuetFund('CA8yuKbrJEgsMyFm75T8Gre7cKT8QJvmgz');

    console.log('******** - inputMoneyTest end - ********');

    response.send('**** charge account success ****');
    return true;
});


function updateConfirmation(txId, confirmations) {
    console.log('updateConfirmation');
    return admin.firestore().collection('tdeposits')
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
                    admin.firestore().collection('tusers').doc(userId).get().then(docUser => {
                            var user = docUser.data();
                            if (user.balance) {
                                user.balance += value;
                            } else {
                                user.balance = value;
                            }
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
        'destination': BCY_WALLET_ADDRESS,
        'confirmations': 100,
        'enable_confirmations':true,
        'callback_url': config.INVERS_BACKEND_URL + '/newPayTest',
        'url': config.INVERS_BACKEND_URL + '/newPayTest'
    };

    return axios.post('https://api.blockcypher.com/v1/bcy/test/payments?token=cb503aaeed0d4817b286ab896d68b0a7', JSON.stringify(payment))
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

exports.addDepositTest = functions.https.onRequest((request, response) => {
    console.log('******** - addDeposit begin - ********');
    var new_deposit = {
        createdBy: 'Qhzpr0EzqfHWG101KIVx'
    };

    admin.firestore()
        .collection('tdeposits')
        .add(new_deposit);
    response.send("Succeed in creating a adding deposit!");

    console.log('******** - addDeposit end - ********');
    return true;
});



exports.newPayTest = functions.https.onRequest((request, response) => {

    let data = request.body;
    console.log('newPayTest callback request body : %O', data);


    response.send('******** - newPayTest  success - ********');

    if(data.hash) {
        return updateConfirmation(data.hash, data.confirmations);
    }
    

    return admin.firestore().collection('tdeposits')
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

exports.tdepositsOnUpdate = functions.firestore
    .document('tdeposits/{depositId}')
    .onUpdate((snap, context) => {
        console.log('******** - depositsOnUpdate - ********');
        return false;
    });

exports.tdepositsOnCreate = functions.firestore
    .document('tdeposits/{depositId}')
    .onCreate((snap, context) => {
        console.log('******** - depositsOnCreate - ********');
        return createPaymentForwarding(snap);
    });
