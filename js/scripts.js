(function($) {
  "use strict";

    // Up - go to top
    $('.up').click(function(){
        $('html, body').animate({scrollTop:0}, 1000);
    });

    // Contact button - go to contact
    $('.top-contact').click(function(){
        $('html, body').animate({
            scrollTop: $("#contact").offset().top
        }, 1000);
    });

    // Menu button - toggle
    $('.top-menu').click(function(){
        $('nav').fadeToggle(300);
    });

    // Tooltip
    $('[data-toggle="tooltip"]').tooltip('hide');

    // Progress bar
    $('.progress .progress-bar').progressbar();




})(jQuery);