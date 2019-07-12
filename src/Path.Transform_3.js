

/**
 * Marker handler
 * @extends {L.CircleMarker}
 */
L.PathTransform.Handle = L.CircleMarker.extend({
  options: {
    className: 'leaflet-path-transform-handler'
  },

  onAdd: function (map) {
    L.CircleMarker.prototype.onAdd.call(this, map);
    if (this._path && this.options.setCursor) { // SVG/VML
      this._path.style.cursor = L.PathTransform.Handle.CursorsByType[
        this.options.index
      ];
    }
  }
});


/**
 * @const
 * @type {Array}
 */
L.PathTransform.Handle.CursorsByType = [
  'nesw-resize', 'nwse-resize', 'nesw-resize', 'nwse-resize'
];


/**
 * @extends {L.Handler.PathTransform.Handle}
 */
L.PathTransform.RotateHandle = L.PathTransform.Handle.extend({
  options: {
    className: 'leaflet-path-transform-handler transform-handler--rotate'
  },

  onAdd: function (map) {
    L.CircleMarker.prototype.onAdd.call(this, map);
    if (this._path && this.options.setCursor) { // SVG/VML
      this._path.style.cursor = 'all-scroll';
    }
  }
});

L.Handler.PathTransform = L.Handler.extend({
	options: {
	    handlerOptions: {
	      radius:      5,
	      fillColor:   '#ffffff',
	      color:       '#202020',
	      fillOpacity: 1,
	      weight:      2,
	      opacity:     0.7,
	      setCursor:   true
	    },
	    transform:  	 true,
    handleClass:       L.PathTransform.Handle,
    rotateHandleClass: L.PathTransform.RotateHandle
	},
	initialize: function(path) {
		this._path = path;
		this._map  = null;
		this._handlersGroup = null;
		this._handlers = [];
    this._rect = null ;
    // handlers
    this._activeMarker   = null;
    this._originMarker   = null;
    this._rotationMarker = null;
    this._rotationOriginPt = null
    this._rotationStart = null;
    this._origine_latlngs = null
    this._current_latlngs = null;
    this._origdistX=0;
    this._origdistY=0;

    this._center = null;
    this._width  = 0;
    this._height = 0;
    this._rotation = 0;
	},

	_createHandlers: function(){
    //width handler
    this._createRotationHandlers();
    // for (var i = 0; i < 4; i++) {
    //   // TODO: add stretching
    //   lat=(this._rect._latlngs[0][i].lat+this._rect._latlngs[0][(i+1)%4].lat)/2
    //   lng=(this._rect._latlngs[0][i].lng+this._rect._latlngs[0][(i+1)%4].lng)/2
    //   latlngs=[lat,lng];
    //   latlngs=this._rect._latlngs[0][i];
    //   this._handlers.push(
    //     this._createHandler(latlngs, i * 2, i)
    //     .addTo(this._handlersGroup));
    // }
    //height handler
    lat=(this._rect._latlngs[0][1].lat+this._rect._latlngs[0][2].lat)/2;
    lng=(this._rect._latlngs[0][1].lng+this._rect._latlngs[0][2].lng)/2;
    this._handlers.push(
      this._createHandler([lat,lng],1, 5)
      .addTo(this._handlersGroup)
    );
    //width
    latW=(this._rect._latlngs[0][3].lat+this._rect._latlngs[0][2].lat)/2;
    lngW=(this._rect._latlngs[0][3].lng+this._rect._latlngs[0][2].lng)/2;
    this._handlers.push(
      this._createHandler([latW,lngW],2, 6)
      .addTo(this._handlersGroup)
    );
	},

  /**
   * Create corner marker
   * @param  {L.LatLng} latlng
   * @param  {Number}   type one of L.Handler.PathTransform.HandlerTypes
   * @param  {Number}   index
   * @return {L.Handler.PathTransform.Handle}
   */
  _createHandler: function(latlng, type, index) {
  	// console.log(this.options);
    var HandleClass = this.options.handleClass;
    // console.log(HandleClass);
    var marker = new HandleClass(latlng,
      L.Util.extend({}, this.options.handlerOptions, {
        className: 'leaflet-drag-transform-marker drag-marker--' +
                   index + ' drag-marker--' + type,
        index:     index,
        type:      type,
      })
    );
    marker.on('mousedown', this._onScaleStart, this);
    return marker;
  },

  _onScaleStart:function(evt){
    // return;
    var marker = evt.target;
    // console.log(marker);
    var map = this._map;
    map.dragging.disable();
    this._activeMarker = marker;
    this._origdistX = this._center._point.x-this._activeMarker._point.x;
    this._origdistY = this._center._point.y-this._activeMarker._point.y;
    this._map
      .off('mousemove', this._onScale,    this)
      .off('mouseup',   this._onScaleEnd, this)
      .on('mousemove', this._onScale,    this)
      .on('mouseup',   this._onScaleEnd, this);

    this._path
      .fire('transformstart', { layer: this._path })
      .fire('scalestart', { layer: this._path, scale: L.point(1, 1) });

  },

  _onScale:function(evt){
    //on recuper l'ecart par rapport a la hauteur et a la longueur
    movW=evt.latlng.lat-this._activeMarker._latlng.lat;
    movH=evt.latlng.lng-this._activeMarker._latlng.lng;
    width =this._width+movW;
    height =this._height+movH;

    // console.log("differences",movH,movW);
  },
  _onScaleEnd:function(evt){

    // movW=evt._point.x-
    // console.log("evt",evt);
    distX = this._center._point.x-evt.layerPoint.x;
    disty = this._center._point.y-evt.layerPoint.y;
    // console.log("events",evt);
    // console.logevents("center",this._center);
    // console.log("x and y",distX,disty);
    // console.log("marker",this._activeMarker);
    // console.log("type",this._activeMarker.options.type);
    // console.log("disty",disty);
    // console.log("_origdistY",this._origdistY);
    // console.log("before",this._width,this._height);
    
    if(this._activeMarker.options.type==2 && distX!=0 && this._origdistX!=0){
      console.log("activeX");
      this._width = this._width*distX/this._origdistX
    }
    if(this._activeMarker.options.type==1  && disty!=0 && this._origdistY!=0){
      console.log("activeY");
      this._height = this._height*disty/this._origdistY
    }


    this._updateRect(this._width,this._height);
    this._map
      .off('mousemove', this._onScale,    this)
      .off('mouseup',   this._onScaleEnd, this);
  },
  /**
   * Bounding polygon
   * @return {L.Polygon}
   */
  _getBoundingPolygon: function() {
    // console.log("_getBoundingPolygon");
    if (this._rectShape) {
      console.log("recsap");
      return L.GeoJSON.geometryToLayer(
        this._rectShape, this.options.boundsOptions);
    } else {
      // console.log("no recshap");
      // console.log(this._path);
      return new L.Rectangle(
        this._path.getBounds(), this.options.boundsOptions);
    }
  },

  /**
   * @return {L.LatLng}
   */
  _getRotationOrigin: function() {
    var latlngs = this._origine_latlngs;
    var lb = latlngs[0];
    var rt = latlngs[2];

    return new L.LatLng(
      (lb.lat + rt.lat) / 2,
      (lb.lng + rt.lng) / 2
    );
  },
  

  /**
   * Rotation marker and small connectin handle
   */
  _createRotationHandlers: function() {
    // return;
    var map     = this._map;
    var latlngs = this._rect._latlngs[0];
    // console.log(this._rect);
    var bottom   = new L.LatLng(
      (latlngs[0].lat + latlngs[3].lat) / 2,
      (latlngs[0].lng + latlngs[3].lng) / 2);
    // hehe, top is a reserved word
    var topPoint = new L.LatLng(
      (latlngs[1].lat + latlngs[2].lat) / 2,
      (latlngs[1].lng + latlngs[2].lng) / 2);
    // console.log(bottom);
    // console.log(topPoint);
    var handlerPosition = map.layerPointToLatLng(
      L.PathTransform.pointOnLine(
        map.latLngToLayerPoint(bottom),
        map.latLngToLayerPoint(topPoint),20)
    );

    // console.log("here");
    this._handleLine = new L.Polyline([topPoint, handlerPosition],
      this.options.rotateHandleOptions).addTo(this._handlersGroup);
    var RotateHandleClass = this.options.rotateHandleClass;
    this._rotationMarker = new RotateHandleClass(handlerPosition,
      this.options.handlerOptions)
      .addTo(this._handlersGroup)
      .on('mousedown', this._onRotateStart, this);
    this._rotationStart=this._rotationMarker;
    this._rotationOrigin = new L.LatLng(
      (topPoint.lat + bottom.lat) / 2,
      (topPoint.lng + bottom.lng) / 2
    );

    this._handlers.push(this._rotationMarker);
  },

  /**
   * If the polygon is not rendered, you can transform it yourself
   * in the coordinates, and do it properly.
   * @param {Object=} options
   */
  enable: function(options) {
    if (this._path._map) {
      this._map = this._path._map;
      if (options) {
        this.setOptions(options);
      }
      L.Handler.prototype.enable.call(this);
    }
  },

  /**
   * Init interactions and handlers
   */
  addHooks: function() {
  	// console.log("addHooks");
    this._init();
  },

  /**
   * Remove handlers
   */
  removeHooks: function() {
    console.log("removed");
    // this._hideHandlers();
    this._path
      .off('dragstart', this._onDragStart, this)
      .off('dragend',   this._onDragEnd,   this);
    this._handlersGroup = null;
    this._rect = null;
    this._handlers = [];
  },

  _onDragStart: function(){

  },

  _onDragEnd: function(evt){
    var rect = this._rect;
    this._init();
  },

  _onRotateStart: function(evt) {
    var map = this._map;

    map.dragging.disable();

    this._rotationOriginPt = map.latLngToLayerPoint(this._getRotationOrigin());
    this._rotationStart    = evt.layerPoint;
    this._angle = 0;
    this._path._map
      .on('mousemove', this._onRotate,     this)
      .on('mouseup',   this._onRotateEnd, this);

  },

  _onRotate(evt){
    var pos = evt.layerPoint;
    var previous = this._rotationStart;
    // console.log(this._rotationMarker);
    var origin   = this._rotationMarker._point;
    // console.log("pos",pos.y,pos.x);
    // console.log("origin",origin.y,origin.x);
    // console.log("previous",previous.y,previous.x);
    //calcule de l'angle de rotation
    this._angle = Math.atan2(pos.y - origin.y, pos.x - origin.x) -
                  Math.atan2(previous.y - origin.y, previous.x - origin.x);
                  console.log(this._angle);
    this._updateRect(this._height,this._width,this._angle);
    this._path.fire('rotate', { layer: this._path, rotation: this._angle });
  },

  _onRotateEnd(evt){
    this._path._map
      .off('mousemove', this._onRotate, this)
      .off('mouseup',   this._onRotateEnd, this);
  },


  _updateRect(width,height,angle){
    var map = this._map;
    // angle=0.5949109565113153;
      y=h2=height/2;
      x=w2=width/2;
      ne=[this._center._latlng.lat+h2,this._center._latlng.lng+w2]
      sw=[this._center._latlng.lat-h2,this._center._latlng.lng-w2]
      se=[this._center._latlng.lat-h2,this._center._latlng.lng+w2]
      nw=[this._center._latlng.lat+h2,this._center._latlng.lng-w2]
    if(typeof angle !=='undefined'){
      acos=Math.acos(angle);
      asin=Math.asin(angle);
      yp=x*acos+y*asin;
    }else{
      this._path.setLatLngs([sw,nw,ne,se]);
      this._init();
    }
    // console.log(ne);
    // console.log(sw);
    // console.log(this._path.getLatLngs());
    // console.log()
    //     l'image de (x;y) par la rotation d'angle alpha et de centre (0,0) est le point (x',y') où 
    // [B]x' = x.cos (alpha) - y.sin (alpha)
    // y' = x. sin (alpha) + y.cos (alpha)[/B]
  },

  _init: function(){
    // return;
    // this._rectShape = this._rect.toGeoJSON();
    var map = this._map;
    if(this._handlersGroup!== null){
      map.removeLayer(this._handlersGroup);
    }
    this._handlersGroup = new L.LayerGroup().addTo(map);
    if(this._path){
      _latlngs=this._path._latlngs;
      // map.removeLayer(this._path);
      // 22.244615500323064 114.0154266357422
      // 22.334833457530486 114.0154266357422
      // 22.334833457530486 114.14108276367189
      // 22.244615500323064 114.14108276367189

    }
    // console.log(_latlngs);
    // this._path = L.Polygon([
    //   [22.244615500323064, 114.0154266357422],
    //   [22.334833457530486, 114.0154266357422],
    //   [22.334833457530486, 114.14108276367189],
    //   [22.244615500323064, 114.14108276367189]
    // ]).addTo(map);
    // console.log("after replacing");
    this._rect = this._getBoundingPolygon();
    // console.log("initield");
    this._origine_latlngs = this._rect._latlngs[0];
    // console.log("_origine_latlngs",this._origine_latlngs);
    // console.log("bounds",this._rect.getBounds());

    var center_latlng = this._getRotationOrigin();
    this._center = this._createHandler([center_latlng.lat,center_latlng.lng],5,1).addTo(this._handlersGroup);
    this._height = this._origine_latlngs[1].lat - this._origine_latlngs[0].lat;
    this._width = this._origine_latlngs[2].lng - this._origine_latlngs[0].lng;
    // console.log("height width before init",[this._width,this._height]);
    this._handlers = [];
    this._createHandlers();
    this._path
      .off('dragstart', this._onDragStart, this)
      .off('dragend',   this._onDragEnd,   this)
      .on('dragstart', this._onDragStart, this)
      .on('dragend',   this._onDragEnd,   this);
  },
  /**
   * Change editing options
   * @param {Object} options
   */
  setOptions: function(options) {
    var enabled = this._enabled;
    if (enabled) {
      this.disable();
    }

    this.options = L.PathTransform.merge({},
      L.Handler.PathTransform.prototype.options,
      options);

    if (enabled) {
      this.enable();
    }

    return this;
  },
})


L.Path.addInitHook(function() {
	// console.log("initied")
  if (this.options.transform) {
    this.transform = new L.Handler.PathTransform(this, this.options.transform);
  }
});
