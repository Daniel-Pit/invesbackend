const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const config = require('../config');

exports.addUser = functions.https.onRequest((request, response) => {
    console.log('******** - addUser begin - ********');
    axios.post(config.BLOCKCYPER_BCY_API)
        .then(res => {
            console.log(res.data);
            var new_user = {
                bcyPrivateKey: res.data.private,
                bcyPublicKey: res.data.public,
                bcyAddress: res.data.address,
                created: Date.now()
            };
            console.log('private key : %s', new_user.bcyPrivateKey);
            console.log('public key : %s', new_user.bcyPublicKey);
            console.log('wallet address : %s', new_user.bcyAddress);
            admin.firestore()
                .collection('users')
                .add(new_user);

            facuetFund(new_user.bcyAddress);
            
            response.send("Succeed in creating a new user!");
            return true;
        })
        .catch(error => {
            response.send("Failed to create a new user!");
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

exports.usersOnCreate = functions.firestore
    .document('users/{userId}')
    .onCreate((snap, context) => {
        console.log('******** - usersOnCreate begin - ********');

        return axios.post(config.URL)
            .then(res => {
                var payload = {
                    ethPrivateKey: res.data.private,
                    ethPublicKey: res.data.public,
                    ethAddress: '0x' + res.data.address,
                    balance:0,
                    rewards:0,
                    created: Date.now()
                };

                console.log('update user data: %O', payload);
                console.log('******** - usersOnCreate end - ********');
                return snap.ref.update(payload);
            })
            .catch(error => {
                console.log(error);
                console.log('******** - usersOnCreate end - ********');
                return false;
            });
    });