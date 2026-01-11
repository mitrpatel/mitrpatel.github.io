var oScene,
    oLoader;
$(document).ready(function(){
    oScene  = $("#scene");
    oLoader = $("#loader");

});

var splash = {
    preload : function(images){
        $(document.body).addClass("loading");

        var iLength = images.length,
            iCount  = 0;

        if(iLength !== 0){
            $.each(images, function(i,imageUrl){
                var image = new Image();

                image.onload = function(){
                    iCount++;

                    var iPercent = parseInt((iCount / iLength) * 100, 10);

                    $("#loader .progress").css({
                        width : iPercent+"%"
                    });

                    if(iCount === iLength){
                        setTimeout(function(){
                            splash.load();
                        }, 300);
                    }
                };
                image.src = imageUrl;
            });
        }else{
            splash.load();
        }
    },
    load : function(){
        oLoader.fadeOut(400, function(){
            $(document.body).removeClass("loading");

            if(Modernizr.csstransforms){
                oScene.parallax({
                    scalarX: 3,
                    scalarY: 3
                });
            }
            $("#scene-wrap").fadeIn(400);
        });
    }
};