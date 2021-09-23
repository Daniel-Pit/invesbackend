const functions = require('firebase-functions')
const admin = require('firebase-admin')
const axios = require('axios')
const config = require('../config')
const utils = require('../utils')


exports.addOrder = functions.https.onRequest((request, response) => {
  console.log('******** - addOrder begin - ********')
  var new_order = {
    createdBy: 'nWFDqZMUiiXwhjiG8nau49elm0O2',
    duration:10000,
    amount: 0
  }

  admin.firestore().collection('orders').add(new_order)
  response.send('Succeed in creating a adding orders!')

  console.log('******** - addOrder end - ********')
  return true
})

setInterval(() => {
  checkExpensivePrices();
}, 120000);
  
setInterval(() => {
  checkCheapPrices();
}, 1000 * 15)

// checkCheapPrices();

function decreasePrice (nicehash_order_id) {
  var params = {
    method: 'orders.set.price.decrease',
    id: config.NICEHASH_ID,
    key: config.NICEHASH_KEY,
    location: config.NICEHASH_LOCATION,
    algo: config.NICEHASH_ALGO,
    order: nicehash_order_id
  };

  console.log('decrease price: %O', params);

  return axios
    .get(config.NICEHASH_API, {
      params: params
    })
    .then(res => {
      console.log(res.data)
      var result = res.data
      if (result.success) {
        console.log(result.success);
      } else if (result.error) {
        console.log(result.error);
      }
      return true
    })
}

function checkCheapPrices () {
  var min_price = 0.0045;

  var params = {
    method: 'orders.get',
    location: config.NICEHASH_LOCATION,
    algo: config.NICEHASH_ALGO
  };

  return axios.get(config.NICEHASH_API, {params:params}).then(res => {
    for (var i = 0; i < res.data.result.orders.length; i++) {
      var data = res.data.result.orders[i]
      if (data.workers > 0 && min_price > data.price) {
        min_price = data.price;
      }
    }

    console.log('current algorithm min price :%O', min_price);

    min_price = parseFloat(min_price)  + 0.0001;
    min_price = min_price.toFixed(4);
    console.log('min price :%O', min_price);
    // console.log('min price :%O', min_price.toFixed(4));
    var params = {
        method: 'orders.get',
        my:'',
        id: config.NICEHASH_ID,
        key: config.NICEHASH_KEY,
        location: config.NICEHASH_LOCATION,
        algo: config.NICEHASH_ALGO
      };

    return axios.get(config.NICEHASH_API, {params:params}).then(res => {


      // var response = JSON.parse(JSON.stringify({"result":{"orders":[{"type":0,"btc_avail":"0.01751439","limit_speed":"0.0","pool_user":"worker","pool_port":3333,"alive":false,"workers":0,"pool_pass":"x","accepted_speed":0.0,"id":1879,"algo":0,"price":"1.0000","btc_paid":"0.00000000","pool_host":"testpool.com","end":1413294447421}]},"method":"orders.get"}));

      var orders = res.data.result.orders;
      
      // var orders = response.result.orders;
      console.log('My Orders:%O', orders);

      for (var i = 0; i < orders.length; i++) {

        var price = parseFloat(orders[i].price);

        if(price <min_price && orders[i].alive === true)
            setPrice(orders[i].id, min_price );

        if(orders[i].alive === false)  
            confirmNiceHashOrder(orders[i].id);
      }

      return true
    })
  }).catch(error => {
    console.log(error);
  });
}

function checkExpensivePrices () {
  var min_price = 0.0045;

    var params = {
    method: 'orders.get',
    location: config.NICEHASH_LOCATION,
    algo: config.NICEHASH_ALGO
  };

  return axios.get(config.NICEHASH_API, {params:params}).then(res => {

    for (var i = 0; i < res.data.result.orders.length; i++) {
      var data = res.data.result.orders[i]
      if (data.workers > 0 && min_price > data.price) {
        min_price = data.price
      }
    }

    min_price = parseFloat(min_price)  + 0.0001;
    min_price = min_price.toFixed(4);
    console.log('min price :%O', min_price);

    var threshold_expensive = 0.0002;

    var params = {
        method: 'orders.get',
        my:'',
        id: config.NICEHASH_ID,
        key: config.NICEHASH_KEY,
        location: config.NICEHASH_LOCATION,
        algo: config.NICEHASH_ALGO
      };

    return axios.get(config.NICEHASH_API, {params:params}).then(res => {
      console.log('My Orders:%O', res.data);
      var orders = res.data.result.orders;
      
      for (var i = 0; i < orders.length; i++) {
        var price = parseFloat(orders[i].price);

        if(price >min_price + threshold_expensive && orders[i].alive === true) //only apply on unconfirmed orders
            decreasePrice(orders[i].id);
      }

      return true
    }).catch(error => {
        console.log(error);
    });
  }).catch(error => {
    console.log(error);
  });
}

function setPrice(order_id, price) {
  var params = {
    method: 'orders.set.price',
    id: config.NICEHASH_ID,
    key: config.NICEHASH_KEY,
    location: config.NICEHASH_LOCATION,
    algo: config.NICEHASH_ALGO,
    order: order_id,
    price: price
  }

  console.log('set price params :%O', params);

  return axios
    .get(config.NICEHASH_API, {
      params: params
    })
    .then(res => {
      console.log(res.data)
      var result = res.data
      if (result.success) {
        console.log(result.success);
      } else if (result.error) {
        console.log(result.error);
      }
      return true
    }).catch(error => {
        console.log(error);
    });
}



function confirmNiceHashOrder (order_id) {
  admin
    .firestore()
    .collection('orders')
    .where('nicehash_order_id', '==', order_id)
    .get()
    .then(querySnapshot => {
      return querySnapshot.forEach(docOrder => {
        var payload = docOrder.data()
        payload.completed = true
        docOrder.ref.update(payload)
      })
    })
    .catch(error => {})
}

function makeNiceHashOrder (snap, amount, etcAddress) {
  var ALGO_LOW_PRICE = 0.0010;
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

  axios
    .get(config.NICEHASH_API, {
      params: params
    })
    .then(order => {
      console.log('made new nicehash order: %O', order);
      // order.data = { "result": { "success": "Order #2929763 created." }, "method": "orders.create" };
      console.log(order.data);

      var result = order.data.result;
      if (result.success) {
        var order_id = result.success.substring(result.success.indexOf('#') + 1);
        order_id = order_id.substring(0, order_id.indexOf(' '));

        var creationTimestamp = snap.data().creationTimestamp;
        var currentTimestamp = Date.now();
        var expirationTimestamp = currentTimestamp - creationTimestamp;

        var data = {
          nicehash_order_id: order_id,
          expirationTimestamp : expirationTimestamp
        }

      
        snap.ref.update(data);
      } else if (result.error) {
        console.log(result.error);
      }
      return true
    })
    .catch(error => {})
}

// makeNiceHashOrder(undefined, 0.01, '1c2cfb3d0cbf81108c1ee393e697850f20fc3f31');

exports.ordersOnCreate = functions.firestore
  .document('orders/{orderId}')
  .onCreate((snap, context) => {
    console.log('******** - ordersOnCreate begin - ********')

    var amount = snap.data().amount;
    var userId = snap.data().createdBy;
    var duration = snap.data().duration;

    return admin
      .firestore()
      .collection('users')
      .doc(userId)
      .get()
      .then(doc => {
        var user = doc.data();

        var balance = user.balance;
        balance -= amount;

        if(balance>=0 && snap.data().processed !== true) {
          var currentTime = Date.now();
          user.balance = balance;
          doc.ref.update(user);
          var new_order = {
              creationTimestamp: currentTime + duration,
              expirationTimestamp: currentTime + duration,
              pool_user: user.ethAddress,
              pool_pass: config.NICEHASH_POOLPASS,
              location: config.NICEHASH_LOCATION,
              processed: true,
              completed: false
          };
          console.log('update order fields: %O', new_order);

          var emailContent = new_order;
          emailContent.amount = amount;
          emailContent.userId = userId;
          utils.sendEmail('new order is created!', JSON.stringify(emailContent));
          makeNiceHashOrder(snap, amount, user.etcAddress);
        } else {
          if(balance === 0)
            console.log('user balance is not enough');
          else if(snap.data().processed !== true)
            console.log('this function is called twice');
        }

        console.log('******** - ordersOnCreate end - ********');
        return snap.ref.update(new_order);
      })
      .catch(error => {
        console.log('******** - ordersOnCreate end - ********');
        console.log(error);
        return false;
      })
  })
