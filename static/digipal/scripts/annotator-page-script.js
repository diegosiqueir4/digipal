/**
 * Intiial annotator script loading
   -- Digipal Project --> digipal.eu
 */

function AnnotatorLoader() {

	var self = this;

	this.init = function() {
		self.digipal_settings = self.get_initial_settings(); // loading settings
		annotator.annotating = false;
		if (annotator.isAdmin == 'True') { // checking if user is logged in as admin
			annotator.annotating = true; // if logged in as admin, the variable annotations is set as true
		}
		var allographs_box = false,
			allographs_loaded = false;
		var select_elements = $('select');
		select_elements.chosen();
		self.switch_annotations();
		self.load_annotations(function() { // once annotations get loaded ...
			self.events(); // events get launched
		});

		self.set_settings(self.digipal_settings); // setting settings
	};

	this.events = function() {
		annotator.activateKeyboardShortcuts(); // calling keyboard events

		// loading annotations through URL (if there are)
		self.load_temporary_vector();
		self.load_stored_vector();

		// activating event on filter button
		var filter_allographs_button = $('#filterAllographs');
		filter_allographs_button.click(function() {
			self.filter_allographs($(this));
		});

		// activating event on settings button

		var settings_button = $('#settings_annotator');
		settings_button.click(function() {
			self.show_settings_window($(this));
		});

		var ontograph_type = $("#ontograph_type");
		ontograph_type.on('change', function(event) {
			self.change_ontograph($(event.target).val());
		});

		ontograph_type.trigger('change'); // Filter just after page is loaded.

		var allow_multiple_dialogs = false;
		var multiple_boxes = $('#multiple_boxes');
		multiple_boxes.on('change', function() {
			if ($(this).is(':checked')) {
				annotator.allow_multiple_dialogs = true;
			} else {
				annotator.allow_multiple_dialogs = false;
			}
		});

		var toolbar_checkbox = $('input[name=toolbar_position]');
		toolbar_checkbox.change(function() {
			self.change_toolbar_position($(this).val());
		});

		var can_edit = $('#development_annotation');
		can_edit.on('change', function() {
			self.switch_mode($(this).is(':checked'));
		});

		var modal_features = $('#modal_features');
		modal_features.click(function() {
			$(this).focus();
		});

		var dialogs = $('.ui-dialog');
		dialogs.click(function() {
			$(this).focus();
		});

		var save = $('#save');
		save.click(function() {
			annotator.saveAnnotation();
		});

		annotator.rectangleFeature.events.register('featureadded', annotator.rectangleFeature,
			self.findRectangleFeatureAdded);

		var allograph_form = $('#panelImageBox .allograph_form');
		allograph_form.on('change', function() {
			self.update_allographs_counter($(this).val());
		});

		$('.number_annotated_allographs').click(function() {
			open_allographs();
		});

		allograph_form.on("liszt:ready", function() {
			highlight_vectors();
		});

		var boxes_on_click = $('#boxes_on_click');
		boxes_on_click.on('change', function() {
			self.boxes_on_click($(this).is(':checked'));
		});

		if (boxes_on_click.is(':checked')) {
			annotator.boxes_on_click = true;
			self.digipal_settings.boxes_on_click = true;
			localStorage.setItem('self.digipal_settings', JSON.stringify(self.digipal_settings));
		}

		var image_to_lightbox = $("#image_to_lightbox");
		image_to_lightbox.click(function() {
			add_to_lightbox($(this), 'image', annotator.image_id, false);
		});

		var multiple_annotations = $('#multiple_annotations');
		multiple_annotations.on('change', function() {
			self.multiple_annotations($(this).is(':checked'));
		});


	};

	this.get_initial_settings = function() {
		var digipal_settings = localStorage.getItem('digipal_settings'); // load settings from LS

		/* Setting default settings */

		if (!digipal_settings) {

			digipal_settings = {
				'allow_multiple_dialogs': false,
				'toolbar_position': 'Vertical',
				'boxes_on_click': false,
				'annotating': annotator.annotating,
				'select_multiple_annotations': false
			};

		} else {
			digipal_settings = JSON.parse(digipal_settings);
		}

		localStorage.setItem('digipal_settings', JSON.stringify(digipal_settings));
		return digipal_settings;
	};

	/*
	this.change_tab = function() {
		var pathArray = window.location.pathname.split('/');
		for (var i = 0; i < pathArray.length; i++) {
			if (pathArray[i] === '') {
				pathArray.splice(i, 1);
				i--;
			}
		}
		var part = pathArray[pathArray.length - 1];
		var tabs = $('a[data-toggle="tab"]');
		$.each(tabs, function() {
			if ('#' + part == $(this).data('target')) {
				$(this).tab('show');
			}
		});
	};
	*/
	/*
		* function set_settings
		@parameter self.digipal_settings
			- settings loaded through the function @get_initial_settings
	*/

	this.set_settings = function(digipal_settings) {
		$('#allow_multiple_dialogs').attr('checked', self.digipal_settings.allow_multiple_dialogs).trigger('change');
		if (self.digipal_settings.toolbar_position == 'Vertical') {
			//$('input[name=toolbar_position]').val('Vertical').trigger('change');
			$('#vertical').attr('checked', true).trigger('change');
		} else {
			//$('input[name=toolbar_position]').val('Horizontal').trigger('change');
			$('#horizontal').attr('checked', true).trigger('change');
		}
		$('#boxes_on_click').attr('checked', self.digipal_settings.boxes_on_click).trigger('change');
		$('#development_annotation').attr('checked', self.digipal_settings.annotating).trigger('change');
		$('#multiple_annotations').attr('checked', self.digipal_settings.select_multiple_annotations).trigger('change');
	};

	/*
		* function load_annotations
		@parameter callback
			- actions to be done after all the annotations get loaded
	*/

	this.load_annotations = function(callback) {
		var request = $.getJSON(annotator.url_annotations, function(data) {
			annotator.annotations = data;
		});

		var chained = request.then(function(data) {

			var map = annotator.map;
			// zooms to the max extent of the map area
			map.zoomToMaxExtent();
			var layer = annotator.vectorLayer;
			var format = annotator.format;
			var annotations = data;

			// Loading vectors

			var features_request = $.getJSON('/digipal/page/' + annotator.image_id + '/vectors/');
			features_request.done(function(data) {
				var features = [];
				for (var j in data) {
					var f = format.read(data[j])[0];
					f.id = j;
					for (var i in annotations) {
						var allograph = annotations[i]['feature'];
						var character_id = annotations[i]['character_id'];
						var graph = annotations[i]['graph'];
						var character = annotations[i]['character'];
						var hand = annotations[i]['hand'];
						var image_id = annotations[i]['image_id'];
						var num_features = annotations[i]['num_features'];
						var display_note = annotations[i]['display_note'];
						if (f.id == annotations[i]['vector_id']) {
							f.feature = allograph;
							f.character_id = character_id;
							f.graph = graph;
							f.character = character;
							f.hand = hand;
							f.image_id = image_id;
							f.num_features = num_features;
							f.display_note = display_note;

							// it serves to differentiate stored and temporary annotations
							f.stored = true;
						}
					}
					f.linked_to = [];
					/* annotator.vectorLayer.features is the array to access to all the features */

					features.push(f);
				}
				// adds all the vectors to the vector layer
				layer.addFeatures(features);
				var vectors = annotator.vectorLayer.features;

				var navigation = new OpenLayers.Control.Navigation({
					'zoomBoxEnabled': false,
					defaultDblClick: function(event) {
						return;
					}
				});

				map.addControl(navigation);
				callback(); // calling all events on elements after all annotations get loaded
			});
		});
	};

	/*
		* function load_temporary_vector
			- loads temporary vectors through URL
	*/

	this.load_temporary_vector = function() {
		var temporary_vectors = getParameter('temporary_vector');
		if (temporary_vectors.length && !no_image_reason) {
			var geoJSON = new OpenLayers.Format.GeoJSON();
			var geo_json, extent, extent_parsed;

			if (temporary_vectors.length > 1) {
				annotator.selectFeature.multiple = true;
			}

			for (var t = 0; t < temporary_vectors.length; t++) {

				var temp = temporary_vectors[t];
				geo_json = JSON.parse(temp);
				var object = geoJSON.read(temp);
				var objectGeometry = object[0];

				objectGeometry.layer = annotator.vectorLayer;

				objectGeometry.style = {
					'fillColor': 'red',
					'strokeColor': 'red',
					"fillOpacity": 0.4
				};

				objectGeometry.described = false;
				objectGeometry.stored = false;
				objectGeometry.contentAnnotation = geo_json.desc;
				objectGeometry.contentTitle = geo_json.title;

				annotator.vectorLayer.features.push(object[0]);

				// select feature
				annotator.selectFeatureById(objectGeometry.id);

				//annotator.map.setCenter(objectGeometry.geometry.getBounds().getCenterLonLat());

				// zoom map to extent
				extent_parsed = geo_json.extent;
				extent = new OpenLayers.Bounds(extent_parsed.left, extent_parsed.bottom, extent_parsed.right, extent_parsed.top);


				// switch annotations if not visible
				if (!geo_json.visibility) {
					switcher.bootstrapSwitch('toggleState');
				}

			}

			annotator.map.zoomToExtent(extent);

			if ($('.dialog_annotations').length) {
				var title = geo_json.title;
				var desc = geo_json.desc;
				$('.name_temporary_annotation').val(title);
				$('.textarea_temporary_annotation').val(desc);
			}

			var dialogs = $('div[role=dialog]');
			dialogs.css({
				'top': geo_json.dialogPosition.top,
				'left': geo_json.dialogPosition.left
			});

		} else {
			return false;
		}
	};

	/*
		* function load_stored_vector
			- loads stored vectors through URL
	*/

	this.load_stored_vector = function() {
		if (typeof vector_id != "undefined" && vector_id && !no_image_reason) {
			// vectorLayer event moveend is triggered on first load so flag this
			initialLoad = true;

			// tries to centre the map every 1/2 second
			interval = setTimeout(function() {

				/* listen for the moveend event
					annotator.vectorLayer.events.register('moveend',
						annotator.vectorLayer, function() {
							// checks if it is a first load, if not kill the interval
							if (initialLoad) {
								initialLoad = false;
							} else {
								clearInterval(interval);
								annotator.vectorLayer.events.remove('moveend');
							}
						});
					*/
				//annotator.selectFeatureByIdAndCentre(vector_id_value);
				// zoom map to extent
				if (getParameter('map_extent').length) {
					var extent_parsed = JSON.parse(getParameter('map_extent')[0]);
					var extent = new OpenLayers.Bounds(extent_parsed.left, extent_parsed.bottom, extent_parsed.right, extent_parsed.top);

					annotator.map.zoomToExtent(extent);
				}

				if (vector_id_value.length == 1) {
					annotator.selectFeatureByIdAndZoom(vector_id_value[0]);
				} else {

					for (var i = 0; i < vector_id_value.length; i++) {
						annotator.selectFeature.multiple = true;
						//annotator.selectFeature.toggle = true;

						annotator.selectFeatureById(vector_id_value[i]);
					}
				}

				// zoom map to extent
				// annotator.map.zoomToExtent(extent);

			}, 500);
		}

		reload_described_annotations();
		trigger_highlight_unsaved_vectors();
	};

	/*
		* function filter_allographs
			-  filter allographs according to hands and allographs
	*/

	this.filter_allographs = function(button) {
		button.addClass('active');
		var checkOutput = '<div class="span6 span6" style="padding:2%;">';
		checkOutput += '<span class="btn btn-small pull-left" id="checkAll">All</span>';
		checkOutput += ' <span class="btn btn-small pull-right" id="unCheckAll">Clear</span><br clear="all" />';
		var annotations = annotator.annotations;
		var h;
		if (!$.isEmptyObject(annotations)) {
			var list = [];
			var vectors = [];
			for (var i in annotations) {
				list.push([annotations[i]['feature']]);
			}
			list.sort();
			for (h = 0; h < list.length; h++) {
				checkOutput += "<p class='paragraph_allograph_check' data-annotation = '" + list[h] + "'>";
				checkOutput += "<input checked='checked' value = '" + list[h] + "' class='checkVectors' id='allograph_";
				checkOutput += list[h] + "' type='checkbox' /> <label for='allograph_" + list[h] + "'' style='display:inline;'>" + list[h] + "</label></p>";
			}
		}
		checkOutput += "</div>";
		checkOutput += '<div class="span6 span6" style="padding:2%;">';
		checkOutput += ' <span class="btn btn-small pull-left" id="checkAll_hands">All</span>';
		checkOutput += ' <span class="btn btn-small pull-right" id="unCheckAll_hands">Clear</span><br clear="all" />';


		if (!$.isEmptyObject(annotations)) {
			var hands = annotator.hands;
			for (h = 0; h < hands.length; h++) {
				checkOutput += "<p style='padding:2%;' data-hand = '" + hands[h].id + "'>" +
					"<input checked='checked' value = '" + hands[h].id + "' class='checkVectors_hands' id='hand_input_" + hands[h].id + "' type='checkbox' /> <label for ='hand_input_" + hands[h].id + "'' style='display:inline;'>" + hands[h].name + "</label></p>";
			}
		}

		checkOutput += "</div>";

		var allographs_filter_box = $('#allographs_filtersBox');
		allographs_filter_box.dialog({
			draggable: true,
			height: 300,
			resizable: false,
			width: 320,
			title: "Filter Annotations",
			close: function() {
				$('#filterAllographs').removeClass('active');
			}
		});


		annotator.removeDuplicate('.paragraph_allograph_check', 'data-annotation', false);
		allographs_filter_box.html(checkOutput);

		annotator.removeDuplicate('.paragraph_allograph_check', 'data-annotation', false);

		/* launching events */
		var check_vectors = $('.checkVectors');
		check_vectors.change(function() {
			annotator.filterAnnotation($(this), 'feature');
		});

		var check_vectors_hands = $('.checkVectors_hands');
		check_vectors_hands.change(function() {
			annotator.filterAnnotation($(this), 'hand');
		});

		var checkAll = $('#checkAll');
		checkAll.click(function() {
			annotator.filterCheckboxes('.checkVectors', 'check');
		});

		var checkAll_hands = $('#checkAll_hands');
		checkAll_hands.click(function() {
			annotator.filterCheckboxes('.checkVectors_hands', 'check');

		});

		var unCheckAll = $('#unCheckAll');
		unCheckAll.click(function() {
			annotator.filterCheckboxes('.checkVectors', 'uncheck');
		});

		var unCheckAll_hands = $('#unCheckAll_hands');
		unCheckAll_hands.click(function() {
			annotator.filterCheckboxes('.checkVectors_hands', 'uncheck');

		});

	};

	// activating bootstrap plugin for switching on and off annotations

	this.switch_annotations = function() {
		var switcher = $('#toggle-state-switch');
		switcher.bootstrapSwitch();
		switcher.bootstrapSwitch('setSizeClass', 'switch-small');
		switcher.on('click', function() {
			switcher.bootstrapSwitch('toggleState');
		});


		switcher.on('switch-change', function(e, data) {
			if ($(this).bootstrapSwitch('state')) {
				annotator.vectorLayer.setVisibility(true);
			} else {
				annotator.vectorLayer.setVisibility(false);
			}
		});

		if (typeof get_annotations != "undefined" && get_annotations == "false") {
			switcher.bootstrapSwitch('toggleState');
		}
	};

	// shows settings window

	this.show_settings_window = function(button) {
		var modal_settings = false;
		var modal_settings_window = $("#modal_settings");
		if (modal_settings) {
			modal_settings = false;
			button.removeClass('active');
			modal_settings_window.parent('.ui-dialog').remove();
		} else {
			modal_settings = true;
			button.addClass('active');
			modal_settings_window.dialog({
				draggable: true,
				resizable: false,
				width: 320,
				title: "Settings",
				close: function(event, ui) {
					modal_settings = false;
					modal_settings_window.parent('.ui-dialog').remove();
					button.removeClass('active');
				}
			});
		}

	};

	// Filter the allograph by ontograph type.
	// Each time an ontograph type is selected in the settings,
	// we enable only the relevant options in the allograph Select.
	this.change_ontograph = function(type_id) {
		var allograph_form = $('#panelImageBox .allograph_form');
		if (type_id == '0') {
			allograph_form.find('option').removeAttr('disabled');
		} else {
			allograph_form.find('option').attr('disabled', 'disabled');
			allograph_form.find('option[class=type-' + type_id + ']').removeAttr('disabled');
		}
		allograph_form.trigger("liszt:updated");
		highlight_vectors();
	};

	// changes toolbar position
	this.change_toolbar_position = function(checkbox_value) {
		if (checkbox_value == "Vertical") {
			$('.olControlEditingToolbar')[0].style.setProperty("position", "fixed", "important");
			$('.olControlEditingToolbar').css({
				"position": "fixed !important",
				"left": "0px",
				"top": "245px",
				"width": "25px",
				"z-index": 1000
			});

		} else {
			$('.olControlEditingToolbar')[0].style.setProperty("position", "absolute", "important");
			self.digipal_settings.toolbar_position = 'Horizontal';
			if (annotator.isAdmin == 'False') {
				$('.olControlEditingToolbar').css({
					"left": "89%",
					"top": 0,
					"width": "120px",
					'border-top-left-radius': '4px',
					'border-bottom-left-radius': '4px',
					"z-index": 1000
				});
			} else {
				$('.olControlEditingToolbar').css({
					"left": "86%",
					"top": 0,
					'border-top-left-radius': '4px',
					'border-bottom-left-radius': '4px',
					"width": "145px",
					"z-index": 1000
				});
			}
		}
		localStorage.setItem('digipal_settings', JSON.stringify(self.digipal_settings));
	};

	// switches mode annotating or not annotating
	this.switch_mode = function(checkbox) {
		var multiple_boxes = $('#multiple_boxes');
		var boxes_on_click = $('#boxes_on_click');
		if (checkbox) {
			multiple_boxes.attr('disabled', 'disabled').attr('checked', false);
			annotator.allow_multiple_dialogs = false;
			annotator.annotating = true;
			self.digipal_settings.annotating = true;
			localStorage.setItem('digipal_settings', JSON.stringify(self.digipal_settings));
			enable_annotation_tools();
		} else {
			multiple_boxes.attr('disabled', false);
			boxes_on_click.attr('checked', true).trigger('change');
			annotator.annotating = false;
			self.digipal_settings.annotating = false;
			localStorage.setItem('digipal_settings', JSON.stringify(self.digipal_settings));
			disable_annotation_tools();
		}
	};

	// updated allographs counter of selected allograph according to the allographs select
	this.update_allographs_counter = function(allograph_id) {
		var n = 0;
		var features = annotator.vectorLayer.features;
		var allograph = $('#panelImageBox .allograph_form option:selected').text();

		for (var i = 0; i < features.length; i++) {
			if (features[i].feature == allograph && features[i].stored) {
				n++;
			}
		}

		//updateFeatureSelect($(this).val());

		if ($('.letters-allograph-container').length) {
			open_allographs();
		}

		$(".number_annotated_allographs .number-allographs").html(n);
	};

	// function to be called as a new features gets drawn
	this.findRectangleFeatureAdded = function(feature) {
		var unsaved_allographs_button = $('.number_unsaved_allographs');
		var last_feature_selected = annotator.last_feature_selected;
		feature.feature.features = [];
		feature.feature.linked_to = [];
		feature.feature.stored = false;
		feature.feature.originalSize = feature.feature.geometry.bounds.clone();
		if (feature.feature.geometry.bounds.top - feature.feature.geometry.bounds.bottom < 10 || feature.feature.geometry.bounds.right - feature.feature.geometry.bounds.left < 15) {
			feature.feature.destroy();
			$('circle').remove();
			$('polyline').remove();
			return false;
		}
		if (annotator.isAdmin == "False") {
			annotator.user_annotations.push(feature.feature.id);
		}

		annotator.selectFeatureById(feature.feature.id);
		//annotator.rectangleFeature.deactivate();
		//annotator.selectFeature.activate();
		annotator.unsaved_annotations.push(feature);

		unsaved_allographs_button.html(annotator.unsaved_annotations.length);

		if (unsaved_allographs_button.hasClass('active')) {
			setTimeout(highlight_unsaved_vectors(unsaved_allographs_button), 100);
		}

		if (last_feature_selected) {
			//$('#panelImageBox .allograph_form').val(last_feature_selected.id).trigger('liszt:updated');
			var features = annotator.vectorLayer.features;
			var n = 0;
			for (var i = 0; i < features.length; i++) {
				if (features[i].feature == last_feature_selected.name && features[i].stored) {
					n++;
				}
			}
			$(".number_annotated_allographs .number-allographs").html(n);
		}

		highlight_vectors();

		var path = $('#' + feature.feature.geometry.id);
		path.dblclick(function(event) {
			var id = $(this).attr('id');
			var feature, boxes_on_click = false;
			var features = annotator.vectorLayer.features;
			for (var i = 0; i < features.length; i++) {
				if (features[i].geometry.id == id) {
					feature = features[i].id;
				}
			}
			if (annotator.boxes_on_click) {
				boxes_on_click = true;
			}
			annotator.boxes_on_click = true;
			annotator.showAnnotation(feature);
			if (!boxes_on_click) {
				annotator.boxes_on_click = false;
				var boxes_on_click_element = $("#boxes_on_click");
				boxes_on_click_element.attr('checked', false);
			}
			event.stopPropagation();
			return false;
		});
	};

	// sets options to open or not boxes when a vector gets clicked on
	this.boxes_on_click = function(is_checked) {
		if (is_checked) {
			annotator.boxes_on_click = true;
			self.digipal_settings.boxes_on_click = true;
			localStorage.setItem('digipal_settings', JSON.stringify(self.digipal_settings));
		} else {
			annotator.boxes_on_click = false;
			self.digipal_settings.boxes_on_click = false;
			localStorage.setItem('digipal_settings', JSON.stringify(self.digipal_settings));
		}
	};

	// sets options to select multiple vectors
	this.multiple_annotations = function(is_checked) {
		if (!is_checked) {
			annotator.selectedAnnotations = [];
			annotator.selectFeature.multiple = false;
			//annotator.selectFeature.toggle = false;
			self.digipal_settings.select_multiple_annotations = false;

		} else {
			annotator.selectFeature.multiple = true;
			self.digipal_settings.select_multiple_annotations = true;
			//annotator.selectFeature.toggle = true;
			if (annotator.selectedFeature) {
				annotator.selectedAnnotations.push(annotator.selectedFeature);
			}
		}
		localStorage.setItem('digipal_settings', JSON.stringify(self.digipal_settings));
	};
}

// launching script in anonymous private function


var loader = new AnnotatorLoader();
loader.init();