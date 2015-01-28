'use strict';
module.exports = function(grunt){
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		less: {
			development: {
				options: {
					paths: ['styles/less']
				},
				files: {
					"styles/style.css": "styles/less/style.less"
				}
			},
			production: {
				options: {
					paths: ['styles/less'],
					yuicompress: true
				},
				files: {
					"styles/style.css": "styles/less/style.less"
				}
			}
		},
		watch: {
			html: {
				files: '**/*.html',
				options: { livereload: true }
			},
			scripts: {
				files: 'scripts/*.js',
				options: { livereload: true }
			},
			styles: {
				files: 'styles/less/*.less',
				tasks: ['less:development'],
				options: { livereload: true }
			}
		},
		connect: {
			uses_defaults: {}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-connect');

	grunt.registerTask('server', ['less:development', 'connect', 'watch']);
};