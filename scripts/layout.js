jQuery(document).ready(function($){

//maintain sidebar height on resize
$(window).resize(function(){
	$('.sidebar').css('height', $(window).innerHeight());
});

});