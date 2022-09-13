module.exports = function(DeviceRegistration) {

  DeviceRegistration.observe("before save", function(ctx, next) {
    if (ctx.isNewInstance) {
        ctx.instance.userId = ctx.instance.userId || ctx.options.ctx.userId;
    } else {
        delete ctx.instance.userId;
    }
    ctx.instance.created = new Date();
    next();
  });

  DeviceRegistration.observe("after save", function(ctx, next) {
    if (ctx.isNewInstance) {
	if (ctx.instance.appName) {
        console.log('ctx.instance.appName ', ctx.instance.appName);
        return next();
      }
      var UserModel = loopback.getModelByType("User");
      UserModel.findById(ctx.instance.userId, ctx.options, function(
        err,
        userInfo
      ) {
        if (userInfo) {
          userInfo.updateAttributes(
            {
              deviceToken: ctx.instance.deviceToken
            },
            ctx.options,
            function(err, dbresult) {
              console.log(
                "update of registrationToken  ",
                err,
                dbresult.name,
                token
              );
              // ignore error
              next(null);
            }
          );
        } else {
          next(null, {});
        }
      });
    } else {
      next();
    }
  });
};
