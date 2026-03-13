/* Theme Name: The Project - Responsive Website Template
 * Author: HtmlCoder
 * Author URI:http://www.htmlcoder.me
 * Author e-mail:htmlcoder.me@gmail.com
 * Version: 2.0.5
 * Created: March 2015
 * License URI: http://support.wrapbootstrap.com/
 * File Description: Place here your custom scripts
 */

(function($){
	$(document).ready(function(){

		// Notify Plugin - The below code (until line 42) is used for demonstration purposes only
		//-----------------------------------------------
		if (($(".main-navigation.onclick").length>0) && !Modernizr.touch ){
			$.notify({
				// options
				message: 'The Dropdowns of the Main Menu, are now open with click on Parent Items. Click "Home" to checkout this behavior.'
			},{
				// settings
				type: 'info',
				delay: 10000,
				offset : {
					y: 150,
					x: 20
				}
			});
		};
		if (!($(".main-navigation.animated").length>0) && !Modernizr.touch && $(".main-navigation").length>0){
			$.notify({
				// options
				message: 'The animations of main menu are disabled.'
			},{
				// settings
				type: 'info',
				delay: 10000,
				offset : {
					y: 150,
					x: 20
				}
			}); // End Notify Plugin - The above code (from line 14) is used for demonstration purposes scripts dosyasını açalım

		};

		// Render $page
		$('.menu-item').click(function (e) {

			e.preventDefault();//eventi durdurur

			yol = $(this).attr('data-url')
			base_url = $('#base_url').attr('data-base-url');

			const nextURL = base_url+'kulliyat/'+yol;
			window.history.replaceState(null, null, nextURL);
			$('#render-container').html('<img src="https://www.risalekulliyati.com/yukleniyor.gif" alt="">');


				$.ajax({
					url: base_url+'kulliyat-render/'+yol,
					success: function(result){
						$('#render-container').html(result)

			 		}
			});
		})

		// Sayfalama
		$(document).on('click', '.pagination-item', function (e) {

			e.preventDefault();//eventi durdurur

			url = $(this).attr('href');
			//nextURL = $(this).attr('data-url');
			//window.history.replaceState(null, null, nextURL);

			$('#render-container').html('<img src="https://www.risalekulliyati.com/yukleniyor.gif" alt="">');

				$.ajax({
					url: url,
					success: function(result, a, b){
						$('#render-container').html(result)
			 		}
			});
		})



		//Daha fazla Ürün Yükleme
		$(document).on('click', '#load_more', function () {
			segment = $(this).attr('data-segment')
			base_url = $('#base_url').attr('data-base-url')

				$.ajax({
					url: base_url+"makale-listesi/"+segment,
					success: function(result){
						if(result.length > 13){
						 $("#products_content").append(result);
						 $('#load_more').attr('data-segment', Number(segment)+9)
					 }else{
						 $("#products_content").append("<div class='bittiyav'>Daha fazla Gösterilecek içerik yok</div>");
						 $('#load_more').remove()
					 }

			 		}
			});


		})


		// Menü İşleri

		$('.sub-menu').each(function() {
        if(!$(this).has('li').length) {
					$(this).remove();
				}
    });

		$('.kat_li').each(function() {
        if($(this).next().hasClass("sub-menu")) {
					$(this).append('<span class="arrow"></span>')
				}
    });


		$('.kat_li:not(.ana)').each(function() {
			$(this).find('a').click(function(){
				//window.location.href = $(this).attr('href');
			})
    });







		$('.dropdown-menu').each(function() {
        if(!$(this).has('li').length) {

					$(this).parent().removeClass("dropdown")
					$(this).prev().removeClass("dropdown-toggle")
					$(this).remove();

				}
    });

		$('.submenuItems').each(function() {
        if(!$(this).has('li').length) {
					$(this).prev().find('i').remove();
				}
    });


		//side menüğ
		$(function() {
		  var Accordion = function(el, multiple) {
		    this.el = el || {};
		    // more then one submenu open?
		    this.multiple = multiple || false;

		    var dropdownlink = this.el.find('.dropdownlink');
				var accordiona = $('.accordion-menu');
		    dropdownlink.on('click',
		                    { el: this.el, multiple: this.multiple },
		                    this.dropdown);
												accordiona.on('mouseleave',
										                    { el: this.el, multiple: this.multiple },
										                    this.dropdown);


		  };

			// search
			$('#search-btn').on('click', function(e){
				e.preventDefault();
				var word = $('.word').val();
				$('#search-form').attr('action', "<?php echo base_url('arama/')?>"+word).submit();
			})

		  Accordion.prototype.dropdown = function(e) {
		    var $el = e.data.el,
		        $this = $(this),
		        //this is the ul.submenuItems
		        $next = $this.next();

		    $next.slideToggle();
		    $this.parent().toggleClass('open');

		    if(!e.data.multiple) {
		      //show only one menu at the same time
		      $el.find('.submenuItems').not($next).slideUp().parent().removeClass('open');
		    }
		  }

		  var accordion = new Accordion($('.accordion-menu'), false);
		})
	}); // End document ready

})(this.jQuery);




(function ($) {
    $.fn.aceResponsiveMenu = function (options) {

        //plugin's default options
        var defaults = {
            resizeWidth: '768',
            animationSpeed: 'fast',
            accoridonExpAll: false
        };

        //Variables
        var options = $.extend(defaults, options),
            opt = options,
            $resizeWidth = opt.resizeWidth,
            $animationSpeed = opt.animationSpeed,
            $expandAll = opt.accoridonExpAll,
            $aceMenu = $(this),
            $menuStyle = $(this).attr('data-menu-style');

        // Initilizing
        $aceMenu.find('ul').addClass("sub-menu");
        $aceMenu.find('ul').siblings('a').append('<span class="arrow "></span>');
        if ($menuStyle == 'accordion') { $(this).addClass('collapse'); }

        // Window resize on menu breakpoint
        if ($(window).innerWidth() <= $resizeWidth) {
            menuCollapse();
        }
        $(window).resize(function () {
            menuCollapse();
        });

        // Menu Toggle
        function menuCollapse() {
            var w = $(window).innerWidth();
            if (w <= $resizeWidth) {
                $aceMenu.find('li.menu-active').removeClass('menu-active');
                $aceMenu.find('ul.slide').removeClass('slide').removeAttr('style');
                $aceMenu.addClass('collapse hide-menu');
                $aceMenu.attr('data-menu-style', '');
                $('.menu-toggle').show();
            } else {
                $aceMenu.attr('data-menu-style', $menuStyle);
                $aceMenu.removeClass('collapse hide-menu').removeAttr('style');
                $('.menu-toggle').hide();
                if ($aceMenu.attr('data-menu-style') == 'accordion') {
                    $aceMenu.addClass('collapse');
                    return;
                }
                $aceMenu.find('li.menu-active').removeClass('menu-active');
                $aceMenu.find('ul.slide').removeClass('slide').removeAttr('style');
            }
        }

        //ToggleBtn Click
        $('#menu-btn').click(function () {
            $aceMenu.slideToggle().toggleClass('hide-menu');
        });


        // Main function
        return this.each(function () {
            // Function for Horizontal menu on mouseenter
            $aceMenu.on('mouseover', '> li a', function () {
                if ($aceMenu.hasClass('collapse') === true) {
                    return false;
                }
                $(this).off('click', '> li a');
                $(this).parent('li').siblings().children('.sub-menu').stop(true, true).slideUp($animationSpeed).removeClass('slide').removeAttr('style').stop();
                $(this).parent().addClass('menu-active').children('.sub-menu').slideDown($animationSpeed).addClass('slide');
                return;
            });
            $aceMenu.on('mouseleave', 'li', function () {
                if ($aceMenu.hasClass('collapse') === true) {
                    return false;
                }
                $(this).off('click', '> li a');
                $(this).removeClass('menu-active');
                $(this).children('ul.sub-menu').stop(true, true).slideUp($animationSpeed).removeClass('slide').removeAttr('style');
                return;
            });
            //End of Horizontal menu function

            // Function for Vertical/Responsive Menu on mouse click
            $aceMenu.on('click', '> li a', function () {
                if ($aceMenu.hasClass('collapse') === false) {
                    //return false;
                }
                $(this).off('mouseover', '> li a');
                if ($(this).parent().hasClass('menu-active')) {
                    $(this).parent().children('.sub-menu').slideUp().removeClass('slide');
                    $(this).parent().removeClass('menu-active');
                } else {
                    if ($expandAll == true) {
                        $(this).parent().addClass('menu-active').children('.sub-menu').slideDown($animationSpeed).addClass('slide');
                        return;
                    }
                    $(this).parent().siblings().removeClass('menu-active');
                    $(this).parent('li').siblings().children('.sub-menu').slideUp().removeClass('slide');
                    $(this).parent().addClass('menu-active').children('.sub-menu').slideDown($animationSpeed).addClass('slide');
                }
            });
            //End of responsive menu function

        });
        //End of Main function
    }
})(jQuery);
