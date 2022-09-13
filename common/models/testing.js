var path = require('path');
module.exports = function(Testing) {
    Testing.test = function(filename, options, cb) {
        //console.log('test ' + filename);
        //var modulename = path.join(__dirname, "../../server/");
        //modulename =  path.join(modulename, filename);
        // for now give full path including extension
        var modulename = filename;
        console.log('module name ' + modulename);
        require.cache[modulename] = undefined;
        delete require.cache[modulename];
        var abc ;
        try {
            abc = require(modulename);
        } catch (ex) {
            console.log('could not load');
        }
        // var keys = Object.keys(require.cache);
        // keys = keys.filter(function(item){
        //     return item.includes("activity");
        // });
        //console.log(keys);
        //console.log(abc);
        //var Activity=loopback.getModelByType('Activity');
        //abc(Activity);
        cb();
    };

    Testing.remoteMethod("test", {
        description: "Test a file",
        accessType: "READ",
        accepts: [
          {
            arg: "filename",
            type: "String",
            description: "filename",
            http: { source: "path" }
          }
        ],
        http: {
          verb: "GET",
          path: "/:filename"
        },
        returns: {
          type: "object",
          root: true
        }
      });

};
