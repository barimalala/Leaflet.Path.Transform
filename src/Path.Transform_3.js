

/**
 * Marker handler
 * @extends {L.CircleMarker}``
 */
 var END = {
  mousedown:     'mouseup',
  touchstart:    'touchend',
  pointerdown:   'pointerup',
  MSPointerDown: 'pointerup',
  click: 'touchend',
};

var MOVE = {
  mousedown:     'mousemove',
  touchstart:    'touchmove',
  pointerdown:   'pointermove',
  MSPointerDown: 'touchmove',
  click: 'touchmove'
};

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
      rotation: true,
      scaling:  true,
      uniformScaling: true,
      maxZoom:  22,
      angleRotationInit: 0,
      centerLatlngInit:null,
      widthInit:0,
      heightInit:0,
      zoomInit:0,
      centering:false,

      handlerOptions: {
        radius:      21,
        fillColor:   '#0E203A',
        color:       '#fff',
        fillOpacity: 1,
        weight:      3,
        opacity:     1,
        setCursor:   true
      },
      transform:     true,
    handleClass:       L.PathTransform.Handle,
    rotateHandleClass: L.PathTransform.RotateHandle
  },
  initialize: function(path) {
    this._path = path;
    this._map  = null;
    this._handlersGroup = null;
    this._handlers = [];
    this._rect = null ;
    this._centerLatlngInit = null;
    // handlers
    this._activeMarker   = null;
    this._ratioMarker   = null;
    this._ratio = 1;
    this._rotationMarker = null;
    this._rotationOriginPt = null
    this._rotationStart = null;
    this._dragStart = null;
    this._dragStartD = null;
    this._origine_latlngs = null
    this._current_latlngs = null;
    this._current_center = null;
    this._origdistX=0;
    this._origdistY=0;
    this._scaleOriginLatlng = [];
    this._scaleOriginIndex = null;

    this._center = null;
    this._width  = 0;
    this._height = 0;
    this._angle = 0;
    this._direction = [];
    this._draggablePt =[];
    this._evtType=null;
  },

  _createHandlers: function(use_temp_params=false){
    //width handler
    height=(use_temp_params)?this._temp_height:this._height;
    width=(use_temp_params)?this._temp_width:this._width;
    [h,w]=[height/2,width/2];
    handlers=[[-h,-w],[-h,w],[h,w],[h,-w]];
    handlers.forEach((h,i)=>{
      h=this._rotatePoint(h,this._angle);
      lat=this._center._latlng.lat+h[0];
      lng=this._center._latlng.lng+h[1];
      if(this._handlers.length>i && this._current_latlngs.length>0){
        console.log("handlers exist");
        this._handlers[i].setLatLngs(this._current_latlngs[i]);
      }else
        this._handlers.push(
          this._createHandler([lat,lng], i * 2, i)
          .addTo(this._handlersGroup));
    });
    this._createRotationHandlers();
    this._creacteDirection();
    this._createDraggable();
    // lat=this._center._latlng.lat+h;
    // lng=this._center._latlng.lng+w;
    // this._handlers.push(
    //   this._createHandler([lat,lng],1, 5)
    //   .addTo(this._handlersGroup)
    // );
    //width handker se place a droite du centre de rotation
    // [h,w]=this._rotatePoint([0,width/2],this._angle);
    // latW=this._center._latlng.lat+h;
    // lngW=this._center._latlng.lng+w;
    // // [lat,lng]=this._rotatePoint([lat,lng],this._angle);
    // this._handlers.push(
    //   this._createHandler([latW,lngW],2, 6)
    //   .addTo(this._handlersGroup)
    // );
  },

  /**
   * Create corner marker
   * @param  {L.LatLng} latlng
   * @param  {Number}   type one of L.Handler.PathTransform.HandlerTypes
   * @param  {Number}   index
   * @return {L.Handler.PathTransform.Handle}
   */
   _createCenter:function(latlng){
    var HandleClass = this.options.handleClass;
    var marker = new HandleClass(latlng,
      {
        radius:      0,
        fillColor:   '#ffffff',
        color:       '#202020',
        fillOpacity: 0, 
        weight:      1,
        opacity:     0,
        setCursor:   true,
        className: 'leaflet-drag-transform-marker drag-marker--' + 10 + ' drag-marker--' + 10,
        index:     10,
        type:      10
      }
    );
    return marker;
   },
  _createHandler: function(latlng, type, index) {
    var that=this;
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
    // marker.on('mousedown', this._onScaleStart, this);
    marker.on('add',((elt)=>{
      L.DomEvent.on(marker._path,'pointerdown mousedown',(evt=>that._onPointerScaleStart(evt,marker)),this);
    }), this);
    return marker;
  },
  _onScaleStart:function(evt){
    // return;
    var marker = evt.target;
    this._destroyRotationHandlers();
    this._destroyDirection();
    this._destroyDraggable();
    // console.log(marker);
    var map = this._map;
    map.dragging.disable();
    this._activeMarker = marker;
    this._scaleOriginIndex=(marker.options.index + 2) % 4;
    this._scaleOriginLatlng = this._handlers[this._scaleOriginIndex].getLatLng();
    // console.log(this._handlers[this._scaleOriginIndex]);
    // console.log(this._center);
    // console.log(this._activeMarker);
    this._origdistX = this._activeMarker._latlng.lng-this._center._latlng.lng;
    this._origdistY = this._activeMarker._latlng.lat-this._center._latlng.lat;
    [this._origdistX,this._origdistY] =this._rotatePoint([this._origdistX,this._origdistY],this._angle);
    this._map
      .off('mousemove', this._onScale,    this)
      .off('mouseup',   this._onScaleEnd, this)
      .on('mousemove', this._onScale,    this)
      .on('mouseup',   this._onScaleEnd, this);
    this._fire("transformstart");
    this._fire("scalestart");
  },
  _onPointerScaleStart:function(evt,marker){
    // return;
    // var marker = evt.target;
    this._evtType=this._evtType||evt.type;
    this._destroyRotationHandlers();
    this._destroyDirection();
    this._destroyDraggable();
    // console.log(marker);
    var map = this._map;
    map.dragging.disable();
    this._activeMarker = marker;
    this._scaleOriginIndex=(marker.options.index + 2) % 4;
    this._scaleOriginLatlng = this._handlers[this._scaleOriginIndex].getLatLng();
    // console.log(this._handlers[this._scaleOriginIndex]);
    // console.log(this._center);
    // console.log(this._activeMarker);
    this._origdistX = this._activeMarker._latlng.lng-this._center._latlng.lng;
    this._origdistY = this._activeMarker._latlng.lat-this._center._latlng.lat;
    [this._origdistX,this._origdistY] =this._rotatePoint([this._origdistX,this._origdistY],this._angle);

    L.DomEvent.off(this._map._container,MOVE[this._evtType],this._onPointerScale,this);
    L.DomEvent.off(this._map._container,END[this._evtType],this._onPointerScaleEnd,this);
    L.DomEvent.on(this._map._container,MOVE[this._evtType],this._onPointerScale,this);
    L.DomEvent.on(this._map._container,END[this._evtType],this._onPointerScaleEnd,this);

    this._fire("transformstart");
    this._fire("scalestart");
  },
  _onPointerScale:function(evt){
    evt.latlng = this._map.mouseEventToLatLng(evt);
    distX = evt.latlng.lng-this._center._latlng.lng;
    disty = evt.latlng.lat-this._center._latlng.lat;
    [distX,disty] =this._rotatePoint([distX,disty],this._angle);
    ratioX=(1+distX/this._origdistX)/2;
    ratioY=(1+disty/this._origdistY)/2;
    // console.log("ratio de reduction",ratioX,ratioY);
    this._temp_width = this._width*ratioX;
    this._temp_height = this._height*ratioY;
    // console.log("_scaleOriginIndex",this._scaleOriginIndex);
    // console.log("width",this._temp_width);

    this._updateRect(this._temp_width,this._temp_height);
    // if(console.log(this._handlers[2].setLatLng));
    this._handlers[0].setLatLng(this._current_latlngs[0]);
    this._handlers[1].setLatLng(this._current_latlngs[1]);
    this._handlers[2].setLatLng(this._current_latlngs[2]);
    this._handlers[3].setLatLng(this._current_latlngs[3]);
    //on met a jours les marker !
    // this._updateHandle(true);
    this._fire("scale",{
      width:this._temp_width,
      height:this._temp_height,
      centerLatlng:this._current_center,
      latlng:this._current_latlngs
    });
  },
  _onScale:function(evt){
    //on recuper l'ecart par rapport a la hauteur et a la longueur
    distX = evt.latlng.lng-this._center._latlng.lng;
    disty = evt.latlng.lat-this._center._latlng.lat;
    [distX,disty] =this._rotatePoint([distX,disty],this._angle);
    ratioX=(1+distX/this._origdistX)/2;
    ratioY=(1+disty/this._origdistY)/2;
    // console.log("ratio de reduction",ratioX,ratioY);
    this._temp_width = this._width*ratioX;
    this._temp_height = this._height*ratioY;
    // console.log("_scaleOriginIndex",this._scaleOriginIndex);
    // console.log("width",this._temp_width);

    this._updateRect(this._temp_width,this._temp_height);
    // if(console.log(this._handlers[2].setLatLng));
    this._handlers[0].setLatLng(this._current_latlngs[0]);
    this._handlers[1].setLatLng(this._current_latlngs[1]);
    this._handlers[2].setLatLng(this._current_latlngs[2]);
    this._handlers[3].setLatLng(this._current_latlngs[3]);
    //on met a jours les marker !
    // this._updateHandle(true);
    this._fire("scale",{
      width:this._temp_width,
      height:this._temp_height,
      centerLatlng:this._current_center,
      latlng:this._current_latlngs
    });
  },
  _onScaleEnd:function(evt){
    distX = evt.latlng.lng-this._center._latlng.lng;
    disty = evt.latlng.lat-this._center._latlng.lat;
    [distX,disty] =this._rotatePoint([distX,disty],this._angle);
    // console.log("distance scaling",)
    ratioX=(1+distX/this._origdistX)/2;
    ratioY=(1+disty/this._origdistY)/2;
    this._width = this._width*ratioX;
    this._height = this._height*ratioY;

    // this._width = this._width*distX/this._origdistX;
    // this._height = this._height*disty/this._origdistY;

    this._updateRect(this._width,this._height);
    this._map
      .off('mousemove', this._onScale,    this)
      .off('mouseup',   this._onScaleEnd, this);
    this._updateHandle();
    this._map.dragging.enable();
    this._scaleOriginIndex=null;
    this._fire("transformed");
    this._fire("scaleend");
  },
  _onPointerScaleEnd:function(evt){
    evt.latlng = this._map.mouseEventToLatLng(evt);
    distX = evt.latlng.lng-this._center._latlng.lng;
    disty = evt.latlng.lat-this._center._latlng.lat;
    [distX,disty] =this._rotatePoint([distX,disty],this._angle);
    // console.log("distance scaling",)
    ratioX=(1+distX/this._origdistX)/2;
    ratioY=(1+disty/this._origdistY)/2;
    this._width = this._width*ratioX;
    this._height = this._height*ratioY;

    // this._width = this._width*distX/this._origdistX;
    // this._height = this._height*disty/this._origdistY;

    this._updateRect(this._width,this._height);
    L.DomEvent.off(this._map._container,MOVE[this._evtType],this._onPointerScale,this);
    L.DomEvent.off(this._map._container,END[this._evtType],this._onPointerScaleEnd,this);
    this._updateHandle();
    this._map.dragging.enable();
    this._scaleOriginIndex=null;
    this._fire("transformed");
    this._fire("scaleend");
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
    var that=this;
    // return;
    var map     = this._map;
    var latlngs = this._rect._latlngs[0];
    // console.log(this._rect);
    var bottom   = new L.LatLng(this._center._latlng.lat,this._center._latlng.lng);
    // hehe, top is a reserved word
    //top point est au milieu au dessus du centre
    [h,w]=this._rotatePoint([this._height/2,0],this._angle);
    var topPoint = new L.LatLng(this._center._latlng.lat+h,this._center._latlng.lng+w);
    let layerPointBottom=map.latLngToLayerPoint(bottom);
    let layerPointTop=map.latLngToLayerPoint(topPoint);
    if( Math.abs(layerPointBottom.x-layerPointTop.x)<=5 && Math.abs(layerPointBottom.y-layerPointTop.y)<=5){
      return
    }

    var handlerPosition = map.layerPointToLatLng(
      L.PathTransform.pointOnLine(layerPointBottom,layerPointTop,10)
    );
    var icoPosition = map.layerPointToLatLng(
      L.PathTransform.pointOnLine(layerPointBottom,layerPointTop,20)
    );
    // console.log("outstwo inde");
    //incliner le handler
    // [h,w]=this._rotatePoint([this._height/2*1.2,0],this._angle);
    // handlerPosition.lat=this._center._latlng.lat+h;
    // handlerPosition.lng=this._center._latlng.lng+w;
    // console.log("here");
    this._handleLine = new L.Polyline([topPoint, handlerPosition],
      this.options.rotateHandleOptions).addTo(this._handlersGroup);
    var RotateHandleClass = this.options.rotateHandleClass;
    var Icon=L.divIcon({
              className: 'rotation-icon',
              iconSize: [36, 36],
              // html: '<svg stroke="#fff" fill="#fff" stroke-width="0" viewBox="0 0 512 512" height="20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M370.72 133.28C339.458 104.008 298.888 87.962 255.848 88c-77.458.068-144.328 53.178-162.791 126.85-1.344 5.363-6.122 9.15-11.651 9.15H24.103c-7.498 0-13.194-6.807-11.807-14.176C33.933 94.924 134.813 8 256 8c66.448 0 126.791 26.136 171.315 68.685L463.03 40.97C478.149 25.851 504 36.559 504 57.941V192c0 13.255-10.745 24-24 24H345.941c-21.382 0-32.09-25.851-16.971-40.971l41.75-41.749zM32 296h134.059c21.382 0 32.09 25.851 16.971 40.971l-41.75 41.75c31.262 29.273 71.835 45.319 114.876 45.28 77.418-.07 144.315-53.144 162.787-126.849 1.344-5.363 6.122-9.15 11.651-9.15h57.304c7.498 0 13.194 6.807 11.807 14.176C478.067 417.076 377.187 504 256 504c-66.448 0-126.791-26.136-171.315-68.685L48.97 471.03C33.851 486.149 8 475.441 8 454.059V320c0-13.255 10.745-24 24-24z"></path></svg>'
              html: `
              <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" width="36.1" height="36.1" viewBox="0 0 36.1 36.1">
              <circle cx="18.05" cy="18.05" r="18" fill="#fff" stroke="#000" stroke-miterlimit="10" stroke-width="0.1px"/>
              <g id="modal">
              <g id="map">
              <g id="main_controller" data-name="main controller">
              <g id="rotate">
              <g id="rotate-cw">
              <g id="Group">
              <path id="Combined-Shape" fill="#112648" fill-rule="evenodd" d="M10.42,14.87h0l.06,0h0l0,0,0,0,3.89,1.49a.84.84,0,0,0,.69-1.52l-.09,0-1.93-.74,2.17-.89a5.42,5.42,0,1,1-3.21,4.81A.84.84,0,1,0,10.44,18a7.08,7.08,0,1,0,4.44-6.38l-.22.09-2.3.94.8-2.08a.83.83,0,0,0-.39-1l-.09,0a.83.83,0,0,0-1,.39l0,.09-1.5,3.89v0l0,.05,0-.09,0,.13a.2.2,0,0,1,0,.07v.1a1.5,1.5,0,0,0,0,.2h0a.42.42,0,0,0,0,.1h0v0l0,.08-.05-.1a.54.54,0,0,0,.07.13.18.18,0,0,0,.05.07v0l.06.06,0,0,.09.06Z" transform="translate(0.05 0.05)"/>
              </g>
              </g>
              </g>
              </g>
              </g>
              </g>
              </svg>
              `
          })
    this._rotationMarker = new L.marker(icoPosition,{icon:Icon})
    // this._rotationMarker = new RotateHandleClass(handlerPosition,
    //   this.options.handlerOptions)
      .addTo(this._handlersGroup);
      // .on('mousedown', this._onRotateStart, this);
      // console.log(this._rotationMarker._icon);
      L.DomEvent.on(this._rotationMarker._icon,'mousedown pointerdown',that._onPointerRotateStart,this);
    this._rotationStart=this._rotationMarker;
    this._rotationOrigin = new L.LatLng(
      (topPoint.lat + bottom.lat) / 2,
      (topPoint.lng + bottom.lng) / 2
    );

    this._handlers.push(this._rotationMarker);
    // console.log("outsinde");
  },

  _destroyDirection: function(){
    if(this._direction!== null){
      this._handlersGroup.removeLayer(this._direction);
    }
  },

  _destroyDraggable: function(){
    if(this._draggablePt!== null){
      this._handlersGroup.removeLayer(this._draggablePt);
    }
  },

  _destroyRotationHandlers: function(){
    if(this._rotationMarker!== null){
      this._handlersGroup.removeLayer(this._rotationMarker);
    }
    if(this._handleLine!== null){
      this._handlersGroup.removeLayer(this._handleLine);
    }
  },
  _destroyScaleHandlers: function(){
    if(this._handlers.length>0){
      this._handlers.forEach((handler)=>{
        this._handlersGroup.removeLayer(handler);
      })
    }
    this._handlers=[]
    if(this._handleLine!== null){
      this._handlersGroup.removeLayer(this._handleLine);
    }
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
    // console.log("removed");
    if(this._handlersGroup!== null){
      this._map.removeLayer(this._handlersGroup);
    }
    // this._hideHandlers();
    this._path
      .off('dragstart', this._onDragStart, this)
      .off('dragend',   this._onDragEnd,   this);
    this._handlersGroup = null;
    this._rect = null;
    this._handlers = [];
  },

  _onDragStart: function(evt){
    // console.log("dragStart");
    // this._map.removeLayer(this._handlersGroup);
    this._destroyScaleHandlers();
    this._fire("transformstart");
    // console.log(evt);
    // alert("dragStart");
    this._path._map.on('mousemove', this._onDrag,this)
  },

  _onDrag: function(evt){
    // console.log("dragging");
    this._dragStart = this._dragStart || evt.latlng;
    var pos = evt.latlng;
    // console.log(this._center);
    this._current_center=L.latLng(
      this._center._latlng.lat+(pos.lat-this._dragStart.lat),
      this._center._latlng.lng+(pos.lng-this._dragStart.lng)
      );
    this._fire("dragging",{
      centerLatlng:this._current_center,
    })
  },

  _onDragEnd: function(evt){
    // alert("dragEnd");
    this._dragStart=null;
    var rect = this._rect;
    this._path._map.off('mousemove', this._onDrag,     this)
    this._updateHandle();
    this._map.dragging.enable();
    this._fire("transformed");
    this._calcRatio();
  },
  _fire(eventName,override){
    this._path.fire(eventName, {
      centerLatlng: this._center._latlng,
      angle: this._angle,
      height: this._height,
      width: this._width,
      path: this._path,
      ...override
    });
  },

  _onRotateStart: function(evt) {
    var map = this._map;

    map.dragging.disable();
    this._destroyScaleHandlers();

    this._rotationOriginPt = map.latLngToLayerPoint(this._getRotationOrigin());
    this._rotationStart    = evt.layerPoint;
    this._rotationStart.x=this._rotationOriginPt.x;
    this._path._map
      .on('mousemove', this._onRotate,     this)
      .on('mouseup',   this._onRotateEnd, this);
    this._fire("transformstart");
    this._fire("rotatestart");
  },

  _onPointerRotateStart: function(evt) {
    this._evtType=this._evtType||evt.type;
    // L.DomEvent.off(this._rotationMarker._icon,'mousedown touchstart pointerdown',this._onPointerRotateStart,this);
    console.log("startRotate");
    var map = this._map;
    map.dragging.disable();
    this._destroyScaleHandlers();

    this._rotationOriginPt = map.latLngToLayerPoint(this._getRotationOrigin());
    this._rotationStart    = this._path._map.mouseEventToLayerPoint(evt);
    this._rotationStart.x=this._rotationOriginPt.x;
    L.DomEvent.on(this._map._container,MOVE[this._evtType],this._onPointerRotate,this);
    L.DomEvent.on(this._map._container,END[this._evtType],this._onPointerRotateEnd,this);
    this._fire("transformstart");
    this._fire("rotatestart");
  },

  _onPointerRotate(evt){
    var pos = this._path._map.mouseEventToLayerPoint(evt);
    // alert("ortation");
    // pos.x=0;
    var previous = this._rotationStart;
    var origin   = this._rotationOriginPt;
    // console.log(previous,origin,pos,this._angle);
    this._angle = Math.atan2(pos.y - origin.y, pos.x - origin.x) -
                  Math.atan2(previous.y - origin.y, previous.x - origin.x);
    if(previous.y>origin.y)this._angle = this._angle+Math.PI;
    // console.log(previous,origin,pos,this._angle);
    this._updateRect(this._width,this._height,this._angle);
    this._fire("rotate");
  },

  _onPointerRotateEnd(evt){
    this._updateHandle();
    this._map.dragging.enable();
    L.DomEvent.off(this._map._container,MOVE[this._evtType],this._onPointerRotate,this);
    L.DomEvent.off(this._map._container,END[this._evtType],this._onPointerRotateEnd,this);
    this._fire("rotateend");
    this._fire("transformed");
  },

  _onRotate(evt){
    var pos = evt.layerPoint;
    // pos.x=0;
    var previous = this._rotationStart;
    var origin   = this._rotationOriginPt;
    // console.log(previous,origin,pos,this._angle);
    this._angle = Math.atan2(pos.y - origin.y, pos.x - origin.x) -
                  Math.atan2(previous.y - origin.y, previous.x - origin.x);
    if(previous.y>origin.y)this._angle = this._angle+Math.PI;
    // console.log(previous,origin,pos,this._angle);
    this._updateRect(this._width,this._height,this._angle);
    this._fire("rotate");
  },

  _onRotateEnd(evt){
    this._updateHandle();
    this._map.dragging.enable();
    this._path._map
      .off('mousemove', this._onRotate, this)
      .off('mouseup',   this._onRotateEnd, this);
    this._fire("rotateend");
    this._fire("transformed");
  },


  _updateRect(width,height,angle,centerLatlng){
    var map = this._map;
    var centerLatlng = centerLatlng || this._center._latlng;
    // console.log("centerLatlng",centerLatlng);
      y=h2=height/2;
      x=w2=width/2;

      angle=this._angle;

      // console.log(angle);
    if(typeof angle !=='undefined' || 1){ //l'angle est deja initialise mais garde quand meme l'ancien code
      neRotate=this._rotatePoint([h2,w2],angle);
      swRotate=this._rotatePoint([-h2,-w2],angle);
      seRotate=this._rotatePoint([-h2,w2],angle);
      nwRotate=this._rotatePoint([h2,-w2],angle);
      
      ne=[centerLatlng.lat+neRotate[0],centerLatlng.lng+neRotate[1]] //ne
      sw=[centerLatlng.lat+swRotate[0],centerLatlng.lng+swRotate[1]] //sw
      se=[centerLatlng.lat+seRotate[0],centerLatlng.lng+seRotate[1]] //se
      nw=[centerLatlng.lat+nwRotate[0],centerLatlng.lng+nwRotate[1]] //nw
      //recuperer le latlong du scaleOrigine pt et reajuster la positionnement de facon a ce que
      //ce point reste fixe !
      // console.log(this._scaleOriginLatlng);
      // console.log("coords",[ne,sw,se,nw])
      // console.log(this._scaleOriginIndex);
      // this._scaleOriginIndex=null;
      switch(this._scaleOriginIndex){
        case 0: //sw
          lat_dep=sw[0]-this._scaleOriginLatlng.lat;
          lng_dep=sw[1]-this._scaleOriginLatlng.lng;
        break;
        case 1: //se
          lat_dep=se[0]-this._scaleOriginLatlng.lat;
          lng_dep=se[1]-this._scaleOriginLatlng.lng;
        break;
        case 2: //ne
          lat_dep=ne[0]-this._scaleOriginLatlng.lat;
          lng_dep=ne[1]-this._scaleOriginLatlng.lng;
        break;
        case 3: //nw
          lat_dep=nw[0]-this._scaleOriginLatlng.lat;
          lng_dep=nw[1]-this._scaleOriginLatlng.lng;
        break;
        default:
        lat_dep=0;
        long_dep=0;
        break;
      }
      // lat_dep=lat_dep/2;
      // lng_dep=lng_dep/2;
      switch(this._scaleOriginIndex){
        case 0: //sw
          sw=[this._scaleOriginLatlng.lat,this._scaleOriginLatlng.lng];
          ne=[ne[0]-lat_dep,ne[1]-lng_dep];
          se=[se[0]-lat_dep,se[1]-lng_dep];
          nw=[nw[0]-lat_dep,nw[1]-lng_dep];
          // sw=[sw[0]-lat_dep,sw[1]-lng_dep];
        break;
        case 1: //se
          se=[this._scaleOriginLatlng.lat,this._scaleOriginLatlng.lng];
          ne=[ne[0]-lat_dep,ne[1]-lng_dep];
          // se=[se[0]-lat_dep,se[1]-lng_dep];
          nw=[nw[0]-lat_dep,nw[1]-lng_dep];
          sw=[sw[0]-lat_dep,sw[1]-lng_dep];
        break;
        case 2: //ne
          ne=[this._scaleOriginLatlng.lat,this._scaleOriginLatlng.lng];
          // ne=[ne[0]-lat_dep,ne[1]-lng_dep];
          se=[se[0]-lat_dep,se[1]-lng_dep];
          nw=[nw[0]-lat_dep,nw[1]-lng_dep];
          sw=[sw[0]-lat_dep,sw[1]-lng_dep];
        break;
        case 3: //nw
          nw=[this._scaleOriginLatlng.lat,this._scaleOriginLatlng.lng];
          ne=[ne[0]-lat_dep,ne[1]-lng_dep];
          se=[se[0]-lat_dep,se[1]-lng_dep];
          // nw=[nw[0]-lat_dep,nw[1]-lng_dep];
          sw=[sw[0]-lat_dep,sw[1]-lng_dep];
        break;
        default:
        lat_dep=0;
        long_dep=0;
        break;
      }
      this._current_latlngs=[se,sw,nw,ne];
      this._current_center=L.latLng((se[0]+nw[0])/2,(se[1]+nw[1])/2);
      this._path.setLatLngs([nw,sw,se,ne]);
    }else{
      ne=[centerLatlng.lat+h2,centerLatlng.lng+w2]
      sw=[centerLatlng.lat-h2,centerLatlng.lng-w2]
      se=[centerLatlng.lat-h2,centerLatlng.lng+w2]
      nw=[centerLatlng.lat+h2,centerLatlng.lng-w2]
      this._path.setLatLngs([sw,nw,ne,se]);
      this._updateHandle();
    }
  },
  _calcRatio(){

    if(this._rotationMarker == null) return true;
    // console.log(this._rotationMarker);
    let point=this._map.latLngToLayerPoint(this._rotationMarker._latlng);
    //on cree un autre point fictif a 100/100 de ce rotation marker
    this._ratioMarker= L.point(point.x+100, point.y+100);
    // let pointRotation= L.point(point.x, point.y);
    let latlng = this._map.layerPointToLatLng(this._ratioMarker);
    let latlng2 = this._rotationMarker._latlng;
    let ratio = Math.abs((latlng2.lat - latlng.lat) / (latlng2.lng - latlng.lng));

    if(this._ratio!==ratio){
      this._ratio = ratio;
      this._fire("ratioChanged",{ratio:this._ratio});
    }
  },
  _rotatePoint(latlng,angle,projectToCenter=false){
    if(projectToCenter)
      latlng=[latlng[0]-projectToCenter.lat,latlng[1]-projectToCenter.lng]
    acos=Math.cos(angle);
    asin=Math.sin(angle);
    const [x,y]=latlng;
    xPrime=(x*acos-y*asin)*this._ratio;
    yPrime=x*asin+y*acos;
    if(projectToCenter)
      return [xPrime+projectToCenter.lat,yPrime+projectToCenter.lng]
    return [xPrime,yPrime]
  },

  _creacteDirection(){
    // return false;
    // height=(use_temp_params)?this._temp_height:this._height;
    // width=(use_temp_params)?this._temp_width:this._width;
    //on met la rectangle de direction a gauche au milieu
    var map = this._map;
    var latlngs = this._rect._latlngs[0];
    var left = new L.LatLng(
      (latlngs[0].lat + latlngs[2].lat) / 2,
      (latlngs[0].lng + latlngs[2].lng) / 2);
    // console.log("a");
    [h,w] = this._rotatePoint([0,-this._width/2],this._angle);
    // console.log("b");
    var leftPoint= new L.LatLng(this._center._latlng.lat+h,this._center._latlng.lng+w);
    var center = new L.LatLng(this._center._latlng.lat,this._center._latlng.lng);
    // console.log("c",this._center._latlng.lat+h,this._center._latlng.lng+w,leftPoint);
    [ha,wa] = this._rotatePoint([0,-this._width/2*1.2],this._angle);
    // console.log("d");
    // var handlerPosition=new L.LatLng(this._center._latlng.lat+ha,this._center._latlng.lng+wa);

    let layerPointCenter=map.latLngToLayerPoint(center);
    let layerPointLeft=map.latLngToLayerPoint(leftPoint);
    if( Math.abs(layerPointCenter.x-layerPointLeft.x)<=5 && Math.abs(layerPointCenter.y-layerPointLeft.y)<=5){
      return;
    }
    var handlerPosition = map.layerPointToLatLng(
      L.PathTransform.pointOnLine(layerPointCenter,layerPointLeft,20)
    );
    var width=handlerPosition.lat-leftPoint.lat;
    // console.log(map.latLngToLayerPoint(handlerPosition));
    position = map.latLngToLayerPoint(handlerPosition);
    // console.log(position);
    var directions=[];
    const [dWidth,dHeight,dPoint]=[5,30,7];
    directions.push({x:position.x-dWidth,y:position.y-dHeight});
    directions.push({x:position.x+dWidth,y:position.y-dHeight});
    directions.push({x:position.x+dWidth,y:position.y+dHeight-dPoint});
    directions.push({x:position.x+dWidth+dPoint,y:position.y+dHeight-dPoint});
    directions.push({x:position.x,y:position.y+dHeight+dPoint});
    directions.push({x:position.x-dWidth-dPoint,y:position.y+dHeight-dPoint});
    directions.push({x:position.x-dWidth,y:position.y+dHeight-dPoint});
    directions.push({x:position.x-dWidth,y:position.y-dHeight});
    directions=directions.map(d=>{
      let latLng=map.layerPointToLatLng(d);
      return this._rotatePoint([latLng.lat,latLng.lng],this._angle,handlerPosition);
    });
    // console.log(directions);
    // directions.push()
    // console.log("e",h,w,this._center._latlng,leftPoint,handlerPosition);
    this._direction = new L.Polygon(directions,{fill: true, weight:1,color:'#fff'}).addTo(this._handlersGroup);
    // this._direction
    this._handlers.push(this._direction);
  },
  _createDraggable(){
    var map = this._map;
    var latlngs = this._rect._latlngs[0];
    [h,w] = this._rotatePoint([this._height/2,this._width/2],this._angle);
    var rightPoint= new L.LatLng(this._center._latlng.lat+h,this._center._latlng.lng+w);
    var center = new L.LatLng(this._center._latlng.lat,this._center._latlng.lng);

    let layerPointCenter=map.latLngToLayerPoint(center);
    let layerPointRight=map.latLngToLayerPoint(rightPoint);
    if( Math.abs(layerPointCenter.x-layerPointRight.x)==0 && Math.abs(layerPointCenter.y-layerPointRight.y)==0){
      layerPointRight.y +=1;
    }
    var handlerPosition = map.layerPointToLatLng(
      L.PathTransform.pointOnLine(layerPointCenter,layerPointRight,
        20)
    );
    this._draggablePt = new L.marker(handlerPosition,{
      icon:L.divIcon({
              className: 'zoom-icon',
              iconSize: [25, 25],
              html: '<svg stroke="#fff" fill="#fff" stroke-width="10" viewBox="0 0 512 512" height="25" width="25" xmlns="http://www.w3.org/2000/svg"><path d="M475.9 246.2l-79.4-79.4c-5.4-5.4-14.2-5.4-19.6 0l-.2.2c-5.4 5.4-5.4 14.2 0 19.6l54.9 54.9-161.8.5.5-161.8 54.9 54.9c5.4 5.4 14.2 5.4 19.6 0l.2-.2c5.4-5.4 5.4-14.2 0-19.6l-79.4-79.4c-5.4-5.4-14.2-5.4-19.6 0l-79.4 79.4c-5.4 5.4-5.4 14.2 0 19.6l.2.2c5.4 5.4 14.2 5.4 19.6 0l54.9-54.9.5 161.8-161.8-.5 54.9-54.9c5.4-5.4 5.4-14.2 0-19.6l-.2-.2c-5.4-5.4-14.2-5.4-19.6 0l-79.4 79.4c-5.4 5.4-5.4 14.2 0 19.6l79.4 79.4c5.4 5.4 14.2 5.4 19.6 0l.2-.2c5.4-5.4 5.4-14.2 0-19.6L80 270.5l161.8-.5-.5 161.8-54.9-54.9c-5.4-5.4-14.2-5.4-19.6 0l-.2.2c-5.4 5.4-5.4 14.2 0 19.6l79.4 79.4c5.4 5.4 14.2 5.4 19.6 0l79.4-79.4c5.4-5.4 5.4-14.2 0-19.6l-.2-.2c-5.4-5.4-14.2-5.4-19.6 0l-54.9 54.9-.5-161.8 161.8.5-54.9 54.9c-5.4 5.4-5.4 14.2 0 19.6l.2.2c5.4 5.4 14.2 5.4 19.6 0l79.4-79.4c5.5-5.4 5.5-14.2 0-19.6z"></path></svg>'
          })
    }).addTo(this._handlersGroup);
    // this._draggablePt.on('mousedown',this._onDragStartD,this)
    L.DomEvent.on(this._draggablePt._icon,'mousedown pointerdown',this._onPointerDragStartD,this);
    this._handlers.push(this._draggablePt);
  },

  _onDragStartD(evt){
    var map = this._map;

    map.dragging.disable();
    this._destroyScaleHandlers();
    this._fire("transformstart");
    this._path._map
      .on('mousemove', this._onDragD,     this)
      .on('mouseup',   this._onDragendD, this);
  },
  _onPointerDragStartD(evt){
    var map = this._map;
    this._evtType=this._evtType||evt.type;
    map.dragging.disable();
    this._destroyScaleHandlers();
    this._fire("transformstart");
    L.DomEvent.on(this._map._container,MOVE[this._evtType],this._onPointerDragD,this);
    L.DomEvent.on(this._map._container,END[this._evtType],this._onPointerDragendD,this);
  },
  _onDragendD(evt){
    this._updateHandle();
    this._map.dragging.enable();
    this._path._map
      .off('mousemove', this._onDragD, this)
      .off('mouseup',   this._onDragendD, this);
    this._fire("transformed");
    this._calcRatio();
    this._dragStartD=null;
  },
  _onDragD(evt){
    this._dragStartD = this._dragStartD || evt.latlng;
    var pos = evt.latlng;
    // console.log(this._center);
    this._current_center=L.latLng(
      this._center._latlng.lat+(pos.lat-this._dragStartD.lat),
      this._center._latlng.lng+(pos.lng-this._dragStartD.lng)
      );
    // console.log("dragging",this._current_center);
    this._updateRect(this._width,this._height,this._angle,this._current_center);
    this._fire("dragging",{
      centerLatlng:this._current_center,
    })
    this._fire("draggingCursor",{
      centerLatlng:this._current_center,
    })
  },
  _onPointerDragendD(evt){
    this._updateHandle();
    this._map.dragging.enable();
    // this._path._map
      // .off('mousemove', this._onDragD, this)
      // .off('mouseup',   this._onDragendD, this);
    L.DomEvent.off(this._map._container,MOVE[this._evtType],this._onPointerDragD,this);
    L.DomEvent.off(this._map._container,END[this._evtType],this._onPointerDragendD,this);
    this._fire("transformed");
    this._calcRatio();
    this._dragStartD=null;
  },
  _onPointerDragD(evt){
    evt.latlng = this._map.mouseEventToLatLng(evt);
    this._dragStartD = this._dragStartD || evt.latlng;
    var pos = evt.latlng;
    // console.log(this._center);
    this._current_center=L.latLng(
      this._center._latlng.lat+(pos.lat-this._dragStartD.lat),
      this._center._latlng.lng+(pos.lng-this._dragStartD.lng)
      );
    // console.log("dragging",this._current_center);
    this._updateRect(this._width,this._height,this._angle,this._current_center);
    this._fire("dragging",{
      centerLatlng:this._current_center,
    })
    this._fire("draggingCursor",{
      centerLatlng:this._current_center,
    })
  },
  _updateHandle(use_temp_params=false){
    //on met a jours le position des pointeurs
    var map = this._map;
    if(this._handlersGroup!== null){
      map.removeLayer(this._handlersGroup);
    }
    this._handlersGroup = new L.LayerGroup().addTo(map);
    this._rect = this._getBoundingPolygon();
    this._origine_latlngs = this._rect._latlngs[0];
    var center_latlng = this._getRotationOrigin();
    // console.log("center_latlng",center_latlng);
    this._center = this._createCenter([center_latlng.lat,center_latlng.lng],10,10).addTo(this._handlersGroup);
    this._handlers = [];
    this._createHandlers(use_temp_params);
  },
   _init: async function(){
    // return;
    // this._rectShape = this._rect.toGeoJSON();
    var map = this._map;
    map.on('load moveend', (e) => {
      this._calcRatio();
      this._updateRect(this._width,this._height,this._angle,this._centerLatlngInit);
      this._updateHandle();
    });
    if(this._handlersGroup!== null){
      map.removeLayer(this._handlersGroup);
    }
    this._handlersGroup = new L.LayerGroup().addTo(map);
    this._rect = this._getBoundingPolygon();
    // console.log("rect",this._rect);
    this._origine_latlngs = this._origine_latlngs || this._rect._latlngs[0];
    var center_latlng = await this.options.centerLatlngInit || this._getRotationOrigin();
    this._center = this._createCenter([center_latlng.lat,center_latlng.lng],10,10).addTo(this._handlersGroup);
    this._height = await this.options.heightInit || this._origine_latlngs[1].lat - this._origine_latlngs[0].lat;
    this._width = await this.options.widthInit || this._origine_latlngs[2].lng - this._origine_latlngs[0].lng;
    this._handlers = [];
    this._createHandlers();
    this._path
      .off('dragstart', this._onDragStart, this)
      .off('dragend',   this._onDragEnd,   this)
      .on('dragstart', this._onDragStart, this)
      .on('dragend',   this._onDragEnd,   this);

    if(this.options.centering){
      //need to deplace rotation Marker before to set Ratio !!!
      if(this.options.zoomInit!==0)
        map.flyTo(center_latlng, this.options.zoomInit)
      else
        map.panTo(center_latlng);
    }else{
      this._calcRatio();
    }

    if(this.options.angleRotationInit!==0 || this.options.centerLatlngInit!== null || 1){
      this._updateRect(this._width,this._height,this._angle,this._centerLatlngInit);
      this._updateHandle();
    }
    
    // if(this.options.centering )
    this._fire("initialished");
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
    // console.log(this.options);
    if(this.options.angleRotationInit !== 0){
      this._angle=this.options.angleRotationInit;
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
