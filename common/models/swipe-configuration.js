loopback = require("loopback");

module.exports = function(SwipeConfiguration) {
  var tofcm = function(obj) {
    Object.keys(obj).forEach(function(k) {
      var val = obj[k];
      switch (typeof val) {
        case "number":
          obj[k] = val.toString();
          break;
        case "boolean":
          obj[k] = val.toString();
          break;
        case "object":
          delete obj[k];
      }
    });
  };

  SwipeConfiguration.observe("after save", function locBeforeSaveFn(ctx, next) {
    if (ctx.instance && ctx.instance.deviceToken) {
          var data = ctx.instance.toJSON();
          tofcm(data);
          data.type = "configure";
          data = JSON.parse(JSON.stringify(data));
          var message = {
            token: ctx.instance.deviceToken,
            data: data
          };
          models.FCM.push(message, ctx.options, function(err, res) {
            console.log("FCM configure response ", err, res);
          });
    }
    next();
  });
};
