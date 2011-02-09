/*
 * PhoneGap is available under *either* the terms of the modified BSD license *or* the
 * MIT License (2008). See http://opensource.org/licenses/alphabetical for full text.
 *
 * Copyright (c) 2005-2010, Nitobi Software Inc.
 * Copyright (c) 2010, IBM Corporation
 */

/**
 * This class provides access to device GPS data.
 * @constructor
 */
function Geolocation() {

    // The last known GPS position.
    this.lastPosition = null;

    // Geolocation listeners
    this.listeners = {};
};

/**
 * Position error object
 *
 * @param code
 * @param message
 */
function PositionError(code, message) {
    this.code = code;
    this.message = message;
};

PositionError.PERMISSION_DENIED = 1;
PositionError.POSITION_UNAVAILABLE = 2;
PositionError.TIMEOUT = 3;

/**
 * Asynchronously acquires the current position.
 *
 * @param {Function} successCallback    The function to call when the position data is available
 * @param {Function} errorCallback      The function to call when there is an error getting the heading position. (OPTIONAL)
 * @param {PositionOptions} options     The options for getting the position data. (OPTIONAL)
 */
Geolocation.prototype.getCurrentPosition = function(successCallback, errorCallback, options) {
    if (successCallback == null) {
        return;
    }

    var maximumAge = 0;
    var timeout = 2147483647;		// 2^31-1, practically infinity for our purposes
    var enableHighAccuracy = false;
    if (typeof options != "undefined") {
        if (typeof options.maximumAge != "undefined") {
             if (options.maximumAge > 0) {
                 maximumAge = options.maximumAge;
            }
        }
        if (typeof options.timeout != "undefined") {
            if (options.timeout >= 0) {
                timeout = options.timeout;
            } else {
                timeout = 0;
            }
        }
        if (typeof options.enableHighAccuracy != "undefined") {
            enableHighAccuracy = options.enableHighAccuracy;
        }
    }

    if (this.lastPosition != null) {
        if ((new Date().getTime() - this.lastPosition.timestamp.getTime()) <= maximumAge) {
            successCallback(this.lastPosition);
            return;
        }
    }

    if (timeout == 0) {
        if (typeof errorCallback != "undefined") {
            errorCallback(new PositionError(PositionError.TIMEOUT, "No suitable cached position and timeout set to 0."));
        }
        return;
    }

    var id = 'g' + PhoneGap.createUUID();
    navigator._geo.listeners[id] = {"success" : successCallback, "fail" : errorCallback };
    PhoneGap.exec(null, null, "Geolocation", "getCurrentPosition", [id, enableHighAccuracy]);

    navigator._geo.listeners[id].timer = setTimeout("navigator._geo.listeners['" + id + "'].timer = null; navigator._geo.fail('" + id + "', PositionError.TIMEOUT, 'Timeout expired.');", timeout);
}

/**
 * Asynchronously watches the geolocation for changes to geolocation.  When a change occurs,
 * the successCallback is called with the new location.
 *
 * @param {Function} successCallback    The function to call each time the location data is available
 * @param {Function} errorCallback      The function to call when there is an error getting the location data. (OPTIONAL)
 * @param {PositionOptions} options     The options for getting the location data such as frequency. (OPTIONAL)
 * @return String                       The watch id that must be passed to #clearWatch to stop watching.
 */
Geolocation.prototype.watchPosition = function(successCallback, errorCallback, options) {
    if (successCallback == null) {
        return;
    }

    var maximumAge = 0;
    var timeout = 2147483647;		// 2^31-1, practically infinity for our purposes
    var enableHighAccuracy = false;
    if (typeof options != "undefined") {
        if (typeof options.maximumAge != "undefined") {
             if (options.maximumAge > 0) {
                 maximumAge = options.maximumAge;
            }
        }
        if (typeof options.timeout != "undefined") {
            if (options.timeout >= 0) {
                timeout = options.timeout;
            } else {
                timeout = 0;
            }
        }
        if (typeof options.enableHighAccuracy != "undefined") {
            enableHighAccuracy = options.enableHighAccuracy;
        }
    }

    if (this.lastPosition != null) {
        if ((new Date().getTime() - this.lastPosition.timestamp.getTime()) <= maximumAge) {
            successCallback(this.lastPosition);
        }
    }

    // This does not actually generate a random 128 bit number, but whatever...
    var id = 0;
    for (var i = 0; i < 16; i++)
        id = (id << 8) + Math.floor((Math.random() * 256));
    var idString = id.toString();

    navigator._geo.listeners[idString] = {"success" : successCallback, "fail" : errorCallback, timeout: timeout };
    PhoneGap.exec(null, null, "Geolocation", "watchPosition", [idString, enableHighAccuracy]);

    navigator._geo.listeners[idString].timer = setTimeout("navigator._geo.listeners['" + idString + "'].timer = null; navigator._geo.fail('" + idString + "', PositionError.TIMEOUT, 'Timeout expired.');", timeout);
}

/**
 * Clears the specified heading watch.
 *
 * @param {String} id       The ID of the watch returned from #watchPosition
 */
Geolocation.prototype.clearWatch = function(id) {
    if (!(id in navigator._geo.listeners) || (id.charAt(0) == 'g')) {
        return;
    }

    clearTimeout(navigator._geo.listeners[id].timer);
    PhoneGap.exec(null, null, "Geolocation", "clearWatch", [id]);
    delete navigator._geo.listeners[id];
};

/*
 * Native callback when watch position has a new position.
 * PRIVATE METHOD
 *
 * @param {String} id
 * @param {Number} lat
 * @param {Number} lng
 * @param {Number} alt
 * @param {Number} acc
 * @param {Number} head
 * @param {Number} vel
 * @param {Number} altacc
 * @param {Number} stamp
 */
Geolocation.prototype.success = function(id, lat, lng, alt, acc, head, vel, altacc, stamp) {
    clearTimeout(navigator._geo.listeners[id].timer);

    var coords = new Coordinates(lat, lng, alt, acc, head, vel, altacc);
    var loc = new Position(coords, stamp);
    this.lastPosition = loc;
    navigator._geo.listeners[id].success(loc);

    if (id.charAt(0) == 'g') {
        delete navigator._geo.listeners[id];
    } else {
        navigator._geo.listeners[id].timer = setTimeout("navigator._geo.listeners['" + id + "'].timer = null; navigator._geo.fail('" + id + "', PositionError.TIMEOUT, 'Timeout expired.');", navigator._geo.listeners[id].timeout);
    }
}

/**
 * Native callback when watch position has an error.
 * PRIVATE METHOD
 *
 * @param {String} id       The ID of the watch
 * @param {Number} code     The error code
 * @param {String} msg      The error message
 */
Geolocation.prototype.fail = function(id, code, msg) {
    if (navigator._geo.listeners[id].timer != null) {
        clearTimeout(navigator._geo.listeners[id].timer);
    } else if (id.charAt(0) == 'g') {
        PhoneGap.exec(null, null, "Geolocation", "clearWatch", [id]);
    }

    if (navigator._geo.listeners[id].fail != null) {
        // For some reason new PositionError(code, msg) doesn't work
        var err = new PositionError(null, null);
        err.code = code;
        err.message = msg;

        navigator._geo.listeners[id].fail(err);
    }

    if (id.charAt(0) == 'g') {
        delete navigator._geo.listeners[id];
    } else {
        navigator._geo.listeners[id].timer = setTimeout("navigator._geo.listeners['" + id + "'].timer = null; navigator._geo.fail('" + id + "', PositionError.TIMEOUT, 'Timeout expired.');", navigator._geo.listeners[id].timeout);
    }
}

/**
 * Force the PhoneGap geolocation to be used instead of built-in.
 */
Geolocation.usingPhoneGap = false;
Geolocation.usePhoneGap = function() {
    if (Geolocation.usingPhoneGap) {
        return;
    }
    Geolocation.usingPhoneGap = true;

    // Set built-in geolocation methods to our own implementations
    // (Cannot replace entire geolocation, but can replace individual methods)
    navigator.geolocation.getCurrentPosition = navigator._geo.getCurrentPosition;
    navigator.geolocation.watchPosition = navigator._geo.watchPosition;
    navigator.geolocation.clearWatch = navigator._geo.clearWatch;
};

PhoneGap.addConstructor(function() {
    navigator._geo = new Geolocation();

    // No native geolocation object for Android 1.x, so use PhoneGap geolocation
    if (typeof navigator.geolocation == 'undefined') {
        navigator.geolocation = navigator._geo;
        Geolocation.usingPhoneGap = true;
    }
});

