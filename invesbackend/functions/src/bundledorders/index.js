const functions = require('firebase-functions')
const admin = require('firebase-admin')
const axios = require('axios')
const config = require('../config')

exports.addBundledOrder = functions.https.onRequest((request, response) => {
  console.log('******** - addBundledOrder begin - ********')
  var new_order = {
    createdBy: 'WPqRSvZp9JT83CsUJk6fAARnZsW2',
    amount: 0.0005
  }

  admin.firestore().collection('bundledOrder').add(new_order)
  response.send('Succeed in creating a adding bundledorders!')

  console.log('******** - addBundledOrder end - ********')
  return true
})

exports.bundledOrdersOnCreate = functions.firestore
  .document('bundledOrder/{bundledOrderId}')
  .onCreate((snap, context) => {
    console.log('******** - bundledOrderOnCreate begin - ********')

    return axios
      .post(config.URL)
      .then(res => {
        var payload = {
          ethPrivateKey: res.data.private,
          ethPublicKey: res.data.public,
          ethAddress: '0x' + res.data.address
        }

        console.log('update bundleOrder document: %O', payload)

        snap.ref.update(payload)
        console.log('******** - bundledOrderOnCreate end - ********')
        return true
      })
      .catch(error => {
        return false
      })
  })

exports.participatesOnWrite = functions.firestore
  .document('bundledOrder/{bundledOrderId}/participants/{docId}')
  .onWrite((snap, context) => {
    console.log('******** - participatesOnWrite begin - ********')

    return true
  })

function makeNiceHashOrder (snap, amount, etcAddress) {
  var ALGO_LOW_PRICE = 0.0010
  var params = {
    method: 'orders.create',
    id: config.NICEHASH_ID,
    key: config.NICEHASH_KEY,
    location: config.NICEHASH_LOCATION,
    algo: config.NICEHASH_ALGO,
    limit: config.NICEHASH_LIMIT,
    pool_host: config.NICEHASH_POOLHOST,
    pool_port: config.NICEHASH_POOLPORT,
    pool_user: etcAddress,
    pool_pass: config.NICEHASH_POOLPASS,
    price: parseFloat(ALGO_LOW_PRICE),
    amount: amount
  }

  console.log('params: %O', params)

  return axios
    .get(config.NICEHASH_API, {
      params: params
    })
    .then(order => {
      console.log('made new nicehash order: %O', order)
      // order.data = { "result": { "success": "Order #2929763 created." }, "method": "orders.create" };
      console.log(order.data)

      var result = order.data.result
      if (result.success) {
        var order_id = result.success.substring(result.success.indexOf('#') + 1)
        order_id = order_id.substring(0, order_id.indexOf(' '))

        var data = {
          nicehash_order_id: order_id
        }

        doc.ref.update(data)
      } else if (result.error) {
        console.log(result.error)
      }
      return true
    })
    .catch(error => {})
}

exports.participatesOnCreate = functions.firestore
  .document('bundledOrder/{bundledOrderId}/participants/{docId}')
  .onCreate((snap, context) => {
    console.log('******** - participatesOnCreate - ********')

    return admin
      .firestore()
      .collection('bundledOrder')
      .doc(context.params.bundledOrderId)
      .get()
      .then(doc => {
        if (doc.exists) {
          return admin
            .firestore()
            .collection('bundledOrder')
            .doc(context.params.bundledOrderId)
            .collection('participants')
            .get()
            .then(participants => {
              console.log('participants:%O', participants)

              var total_amount = 0
              participants.forEach(docParticipant => {
                console.log('participant:%O', docParticipant.data())
                var participant = docParticipant.data()
                if (participant.amount) {
                  total_amount += parseFloat(participant.amount)
                }
              })

              console.log('total participants order amount:%f', total_amount)

              if (total_amount >= parseFloat(doc.data().amount)) {
                console.log(' trigger new nicehash bundledorder')
                return makeNiceHashOrder(
                  doc,
                  doc.data().amount,
                  doc.data().ethAddress
                )
              } else return false
            })
        } else {
          console.log('nothing exists')
          return false
        }
      })
      .catch(error => {
        console.log(error)
      })
  })
