module.exports = function(UserMessage) {

    UserMessage.observe("before save", function(ctx, next) {
        if (ctx.isNewInstance && ctx.instance) {
          ctx.instance.created = new Date();
          ctx.instance.userId = ctx.options.ctx.userId;
          ctx.instance.name = ctx.options.ctx.username;
        }
        next();
      });


    var sendMessageToUser = function(message, options, userId, next) {
        var UserModel = loopback.getModelByType("BaseUser");
        UserModel.findById(userId, options, function(err, user) {
          if (err) {
            return next(err);
          }
          if (!user) {
            return next();
          }
          var FCM = loopback.getModel("FCM");
          message.token = user.deviceToken;
          next();
          FCM.push(message, options, function(err, res) {
            console.log("FCM ", err, res);
          });
        });
      };

    UserMessage.observe("after save", function(ctx, next) {
        next();
        if (!ctx.isNewInstance) {
            return;
          }
          if (!ctx.instance) {
            return;
          }

        var now = new Date();
        var message = {
            android: {
              priority: "high"
            },
            notification : {
                title : ctx.instance.title,
                body : ctx.instance.message
            }
          };
          sendMessageToUser(message, ctx.options, ctx.instance.receiverUserId, function() {

          });
    });
};
