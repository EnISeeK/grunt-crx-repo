'use strict';

var archiver = require('archiver');
var path = require('path');
var request = require('request');
var temp = require('temp').track();
var fs = require('fs');

module.exports = function(grunt) {
  grunt.registerMultiTask('publishCrx', 'Publish an unpacked chrome extension to a crx-repo server.', function() {
    grunt.log.writeln('publishCrx');

    var options = this.options({
      repoPort: 5001
    });

    if (options.unpackedDir === undefined) {
      grunt.fail.fatal(this.name + ':' + this.target + ' task is missing config: options.unpackedDir');
    }

    if (options.repoAddress === undefined) {
      grunt.fail.fatal(this.name + ':' + this.target + ' task is missing config: options.repoAddress');
    }

    if (options.name === undefined) {
      var manifest = grunt.file.readJSON(path.join(options.unpackedDir, 'manifest.json'));
      options.name = manifest.name;
    }

    var done = this.async();
    var tempPath = temp.openSync('sc-dev-toolbar').path;
    var writeStream = fs.createWriteStream(tempPath);
    writeStream.on('finish', function() {
      var uploadUrl = 'http://' + options.repoAddress + ':' + options.repoPort + '/upload';
      var formData = {
        name: options.name,
        zippedExtension: fs.createReadStream(tempPath)
      };
      request.post({url: uploadUrl, formData: formData}, function optionalCallback(err, response, body) {
        if (err) {
          grunt.log.error('upload failed: ', err);
          return done(err);
        }

        if (response.statusCode !== 201) {
          grunt.log.error('upload request failed: ', body);
          return done(body);
        }

        grunt.log.ok('Upload successful!');
        done();
      });
    });

    var archive = archiver('zip');
    archive.on('error', function(err){
      grunt.log.error('packing extension failed:', err);
      return done(err);
    });
    archive.on('finish', function() { writeStream.end(); });
    archive.pipe(writeStream);
    archive.bulk([{expand: true, cwd: options.unpackedDir, src: ['**/*'], dest: '.'}]);
    archive.finalize();
  });
};
