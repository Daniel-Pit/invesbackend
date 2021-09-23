const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const config = require('../config');

exports.authOnCreate = functions.auth.user()
    .onCreate((user) => {
        console.log('******** - authOnCreate begin - ********');
        console.log(user);
        var email = user.email;
        var uid = user.uid;

        return axios.post(config.URL)
            .then(res => {

                var payload = {
                    ethPrivateKey: res.data.private,
                    ethPublicKey: res.data.public,
                    ethAddress: '0x' + res.data.address,
                    balance:0,
                    rewards:0,
                    email:email,
                    created: Date.now()
                };

                console.log('update user document: %O', payload);

         
                console.log('******** - authOnCreate end - ********');
                admin.firestore()
	                .collection('users')
	                .doc(uid)
	                .set(payload);
                return true;
            })
            .catch(error => {

                return false;
            });
    });