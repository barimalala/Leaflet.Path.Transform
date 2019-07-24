

/**
 * Marker handler
 * @extends {L.CircleMarker}``
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
        radius:      5,
        fillColor:   '#ffffff',
        color:       '#202020',
        fillOpacity: 1,
        weight:      2,
        opacity:     0.7,
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
    this._originMarker   = null;
    this._rotationMarker = null;
    this._rotationOriginPt = null
    this._rotationStart = null;
    this._dragStart = null;
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
    this._destroyRotationHandlers();
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

  _onScale:function(evt){
    //on recuper l'ecart par rapport a la hauteur et a la longueur
    // console.log(evt);
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
    [h,w]=this._rotatePoint([this._height/2*1.2,0],this._angle);
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
    this._dragStart=null;
    var rect = this._rect;
    this._path._map.off('mousemove', this._onDrag,     this)
    this._updateHandle();
    this._map.dragging.enable();
    this._fire("transformed");
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

  _onRotate(evt){
    var pos = evt.layerPoint;
    // pos.x=0;
    var previous = this._rotationStart;
    var origin   = this._rotationOriginPt;
    this._angle = Math.atan2(pos.y - origin.y, pos.x - origin.x) -
                  Math.atan2(previous.y - origin.y, previous.x - origin.x);
                  // console.log(this._angle);
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

  _rotatePoint(latlng,angle){
    acos=Math.cos(angle);
    asin=Math.sin(angle);
    const [x,y]=latlng;
    xPrime=x*acos-y*asin;
    yPrime=x*asin+y*acos;
    return [xPrime,yPrime]
  },

  _updateHandle(use_temp_params){
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

    // console.log("angle",this._angle);

    if(this.options.angleRotationInit!==0 || this.options.centerLatlngInit!== null){
      this._updateRect(this._width,this._height,this._angle,this._centerLatlngInit);
      this._updateHandle();
    }
    if(this.options.centering){
      if(this.options.zoomInit!==0)
        map.flyTo(center_latlng, this.options.zoomInit)
      else
        map.panTo(center_latlng);
    }
    
    // if(this.options.centering )
    await this._fire("initialished");
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
