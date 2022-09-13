var loopback = require("loopback");
var async = require("async");

module.exports = function(UserInfo) {
  UserInfo.statusCache = {};

  UserInfo.OnlineContacts = {};

  UserInfo.observe("after save", function(ctx, next) {
    
    next();

    if (ctx.instance) {
      // toJson ?
      UserInfo.statusCache[ctx.instance.id] = ctx.instance.toJSON;
      var info = ctx.instance;
      var models = UserInfo.app.models;
      var ts = new Date();
      ts = ts.getTime();
      ts = ts - 30 * 60 * 1000;
      var filter = {
        where: {
          contactUserId: ctx.instance.id,
          lastViewedAt: { gt: ts }
        }
      };

      models.Contact.find(filter, ctx.options, function(err, list) {
        list.forEach(function(contact) {
          models.AppUser.findById(contact.ownerUserId, ctx.options, function(
            err,
            user
          ) {
            if (user && user.deviceToken) {
              console.log("sending to user ", user.username);
              var message = {
                token: user.deviceToken,
                data: {
                  type: "ContactInformationChanged",
                  messageForUserId: user.id.toString(),
                  contactUserId: info.id.toString(),
                  latitude: info.latitude.toString(),
                  longitude: info.longitude.toString(),
                  accuracy: info.accuracy.toString(),
                  lastLocationTime: info.lastLocationTime.toJSON(),
                  provider: info.provider || "x"
                }
              };
              models.FCM.push(message, ctx.options, function(err, res) {});
            }
          });
        });
      });
    }
  });

  UserInfo.prototype.next = function(options, cb) {
    var response = {
      finishJob: true,
      nextJobMinutes: 30,
      startService: false
    };
    return cb(null, response);
  };

  UserInfo.remoteMethod("next", {
    description: "get next action",
    accessType: "READ",
    isStatic: false,
    accepts: [],
    http: {
      verb: "GET",
      path: "/next"
    },
    returns: {
      type: "object",
      root: true
    }
  });
};
