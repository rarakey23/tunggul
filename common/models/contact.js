var loopback = require("loopback");
var async = require("async");

module.exports = function(Contact) {

  Contact.prototype.requestinfo = function(options, cb) {
      var Activity = loopback.getModelByType('Activity');
      var data = {
        type : 'ViewContact',
        remarks : "via old interface /api/contacts/:id/requestinfo",
        contactId : this.id.toString()
      };
      Activity.create(data, options, function(err, rec){
        cb(err, rec);
      });
  };

  Contact.remoteMethod("requestinfo", {
    description: "Request latest info",
    accessType: "WRITE",
    isStatic: false,
    accepts: [],
    http: {
      verb: "POST",
      path: "/requestinfo"
    },
    returns: {
      type: "object",
      root: true
    }
  });
};
