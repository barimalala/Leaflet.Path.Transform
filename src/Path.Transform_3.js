

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
    this._angle = 0;
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
    // le height handler se place au dessus du centre de rotation
    // console.log(this._angle);
    // console.log(this._height);
    [h,w]=this._rotatePoint([this._height/2,0],this._angle);
    lat=this._center._latlng.lat+h;
    lng=this._center._latlng.lng+w;
    this._handlers.push(
      this._createHandler([lat,lng],1, 5)
      .addTo(this._handlersGroup)
    );
    //width handker se place a droite du centre de rotation
    [h,w]=this._rotatePoint([0,this._width/2],this._angle);
    latW=this._center._latlng.lat+h;
    lngW=this._center._latlng.lng+w;
    // [lat,lng]=this._rotatePoint([lat,lng],this._angle);
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
    this._updateHandle();
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
    //top point est au milieu au dessus du centre
    [h,w]=this._rotatePoint([this._height/2,0],this._angle);
    var topPoint = new L.LatLng(this._center._latlng.lat+h,this._center._latlng.lng+w);
    var handlerPosition = map.layerPointToLatLng(
      L.PathTransform.pointOnLine(
        map.latLngToLayerPoint(bottom),
        map.latLngToLayerPoint(topPoint),20)
    );
    //incliner le handler
    [h,w]=this._rotatePoint([this._height/2+0.01,0],this._angle);
    handlerPosition.lat=this._center._latlng.lat+h;
    handlerPosition.lng=this._center._latlng.lng+w;
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
    if(this._handlersGroup!== null){
      map.removeLayer(this._handlersGroup);
    }
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
    this._updateHandle();
  },

  _onRotateStart: function(evt) {
    var map = this._map;

    map.dragging.disable();

    this._rotationOriginPt = map.latLngToLayerPoint(this._getRotationOrigin());
    this._rotationStart    = evt.layerPoint;
    this._rotationStart.x=this._rotationOriginPt.x;
    this._path._map
      .on('mousemove', this._onRotate,     this)
      .on('mouseup',   this._onRotateEnd, this);

  },

  _onRotate(evt){
    var pos = evt.layerPoint;
    // pos.x=0;
    var previous = this._rotationStart;
    var origin   = this._rotationOriginPt;
    this._angle = Math.atan2(pos.y - origin.y, pos.x - origin.x) -
                  Math.atan2(previous.y - origin.y, previous.x - origin.x);
                  // console.log(this._angle);
    this._updateRect(this._width,this._height,this._angle);
    this._path.fire('rotate', { layer: this._path, rotation: this._angle });
  },

  _onRotateEnd(evt){
    this._updateHandle();
    this._path._map
      .off('mousemove', this._onRotate, this)
      .off('mouseup',   this._onRotateEnd, this);
  },


  _updateRect(width,height,angle){
    var map = this._map;
      y=h2=height/2;
      x=w2=width/2;
      angle=this._angle;
    if(typeof angle !=='undefined'){
      neRotate=this._rotatePoint([h2,w2],angle);
      swRotate=this._rotatePoint([-h2,-w2],angle);
      seRotate=this._rotatePoint([-h2,w2],angle);
      nwRotate=this._rotatePoint([h2,-w2],angle);
      
      ne=[this._center._latlng.lat+neRotate[0],this._center._latlng.lng+neRotate[1]] //ne
      sw=[this._center._latlng.lat+swRotate[0],this._center._latlng.lng+swRotate[1]] //sw
      se=[this._center._latlng.lat+seRotate[0],this._center._latlng.lng+seRotate[1]] //se
      nw=[this._center._latlng.lat+nwRotate[0],this._center._latlng.lng+nwRotate[1]] //nw
      this._path.setLatLngs([nw,sw,se,ne]);
      // this._updateHandle();
    }else{
      ne=[this._center._latlng.lat+h2,this._center._latlng.lng+w2]
      sw=[this._center._latlng.lat-h2,this._center._latlng.lng-w2]
      se=[this._center._latlng.lat-h2,this._center._latlng.lng+w2]
      nw=[this._center._latlng.lat+h2,this._center._latlng.lng-w2]
      this._path.setLatLngs([sw,nw,ne,se]);
      this._updateHandle();
    }
  },

  _rotatePoint(latlng,angle){
    acos=Math.cos(angle);
    asin=Math.sin(angle);
    const [x,y]=latlng;
    xPrime=x*acos-y*asin;
    yPrime=x*asin+y*acos;
    return [xPrime,yPrime]
  },

  _updateHandle(){
    //on met a jours le position des pointeurs
    var map = this._map;
    if(this._handlersGroup!== null){
      map.removeLayer(this._handlersGroup);
    }
    this._handlersGroup = new L.LayerGroup().addTo(map);
    this._rect = this._getBoundingPolygon();
    this._origine_latlngs = this._rect._latlngs[0];
    var center_latlng = this._getRotationOrigin();
    this._center = this._createHandler([center_latlng.lat,center_latlng.lng],5,1).addTo(this._handlersGroup);
    this._handlers = [];
    this._createHandlers();
  },
  _init: function(){
    // return;
    // this._rectShape = this._rect.toGeoJSON();
    var map = this._map;
    if(this._handlersGroup!== null){
      map.removeLayer(this._handlersGroup);
    }
    this._handlersGroup = new L.LayerGroup().addTo(map);
    this._rect = this._getBoundingPolygon();
    this._origine_latlngs = this._rect._latlngs[0];
    var center_latlng = this._getRotationOrigin();
    this._center = this._createHandler([center_latlng.lat,center_latlng.lng],5,1).addTo(this._handlersGroup);
    this._height = this._origine_latlngs[1].lat - this._origine_latlngs[0].lat;
    this._width = this._origine_latlngs[2].lng - this._origine_latlngs[0].lng;
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
