loopback = require("loopback");

module.exports = function(UserConfiguration) {
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

  UserConfiguration.observe("after save", function locBeforeSaveFn(ctx, next) {
    if (ctx.instance) {
      var userId = ctx.instance.userId;
      var models = UserConfiguration.app.models;
      models.AppUser.findById(userId, ctx.options, function(err, user) {
        if (user && user.deviceToken) {
          var data = ctx.instance.toJSON();
          tofcm(data);
          data.type = "configure";
          data = JSON.parse(JSON.stringify(data));
          var message = {
            token: user.deviceToken,
            data: data
          };
          models.FCM.push(message, ctx.options, function(err, res) {
            console.log("FCM configure response ", err, res);
          });
        }
      });
    }
    next();
  });
};
