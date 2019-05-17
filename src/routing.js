define(function(require,exports,module) {
  var $ = require('jquery');

  let routing = this;
  /*************************************************************************
   * Testing
   *************************************************************************/
  routing.DEBUGGING = false;
  function debugLog(text)
  {
    if(routing.DEBUGGING)
    {
      console.log(text);
    }
  }
  function testFn(fnName,fn,args,expected,equality = null)
  {
    if(!equality) equality = (x,y) => x === y;
    debugLog("///////////////////////////////////////////////////////////");
    debugLog("Test " + fnName + "?");
    let res = fn.apply(null,args);
    debugLog(fnName + "(" + args.reduce((a,b) => "" + a + "," + b) + ")");
    debugLog("Args:" );
    args.forEach(function(arg) {
      debugLog(arg);
    });
    debugLog("Expected? " + expected);
    debugLog("Actual? " + res);
    debugLog(equality(expected,res) ? "PASS" : "FAIL");
    debugLog("///////////////////////////////////////////////////////////");
  }
  /*************************************************************************
   *
   *  Router additions start 
   *
   *
   *************************************************************************/
  /*pushStateLock
    When enabled, you can navigate the page without
    changing the page history.  This allows for
    seamless 'jumps', say, from /#/guide/3 to /#/guide/1,
    which may itself be built on moving from #/guide/3 to #/guide/2,
    and from #/guide/2 to #/guide/1 ,  where these intermediate steps
    should not be added to the window history and should be invisible
    to the user
  */
  this.pushStateLock = false;
  routing.pushStateLock = false;

  /* ******************************************************************* */
  let viewFacilitiesSelector = "a:contains('View Facilities')";
  var assessmentsSelector  = ".js-next-prev:contains('Assessments')";
  var medicalDetoxSelector  = ".js-next-prev:contains('Medical Detox')";
  var residentialSelector  = ".js-next-prev:contains('Residential')";
  var outpatientSelector  = ".js-next-prev:contains('Outpatient')";
  var twelveStepProgramsSelector  = ".btn:contains('Twelve Step Programs')";

  var guidedSearchSelector = ".js-next-prev:contains('Guided Search')";
  var infoSelector = "a:has(span:contains('Info'))";
  var feedbackSelector = "a:has(span:contains('Feedback'))";

  var prevButtonText     = "Previous";
  var prevButtonSelector = ".js-next-prev:contains('"+prevButtonText+"')";
  var nextButtonSelector = ".js-next-prev:contains('Next')";
  /* ******************************************************************/
  /* Util */
  let jsonEquals = (a,b) => JSON.stringify(a) == JSON.stringify(b);

  let navigationRoutes = ["outpatient","residential","guide"];
  let popupRoutes      = ["twelve-step-programs","info","feedback"];
  let viewFacilitiesRoutes = ["facilities","medical-detox","assessments"];
  /* Tests */
  testFn("viewFacilitiesRoutes",
         (x) => x.indexOf("facilities") >= 0,
         [viewFacilitiesRoutes],
         true);
  testFn("viewFacilitiesRoutes",
         (x) => x.indexOf("medical-detox") >= 0,
         [viewFacilitiesRoutes],
         true);
  testFn("viewFacilitiesRoutes",
         (x) => x.indexOf("assessments") >= 0,
         [viewFacilitiesRoutes],
         true);
  testFn("viewFacilitiesRoutes",
         (x) => x.indexOf("outpatient") >= 0,
         [viewFacilitiesRoutes],
         false);
  /* ***********************************************************************/
  let selectorLookupTable = { "medical-detox" : medicalDetoxSelector,
                                "residential"   : residentialSelector,
                                "outpatient"    : outpatientSelector,
                                "guide"         : guidedSearchSelector,
                                "twelve-step-programs" : twelveStepProgramsSelector,
                                "info" : infoSelector,
                                "feedback" : feedbackSelector,
                                "assessments" : assessmentsSelector,
                                "facilities" : viewFacilitiesSelector
                              };
  let navigationRouteLastPageLookup = { "residential" : 4,
                                        "outpatient" : 4,
                                        "guide" : 5
                                        };
  let popupModalSelectorLookup = { "info" : "#about",
                                   "feedback" : "#feedback-modal",
                                   "twelve-step-programs" : "#twelveStep"};
    
  /*
   * When we are popping state with the forward and backward buttons,
   navigate to those urls 
  */
  $(window).on('popstate',function(e) {
    debugLog("Popstate");
    let newDataRoute = window.history.state;

    /*
     * If we have no data route saved in the history,  this url
     * has just been typed into the url box,  and a data route must be produced.

     * Fortunately, even if this is somehow not the case,  if we don't have a
     * dataRoute we still need one anyways, and this will get it for us
     */
    if(newDataRoute === null)
    {
      newDataRoute = routeToDataRoute(getRouteFromWindowUrl());
    }
    /*
      Edge case: facilities
    */
    if(newDataRoute.routeName === "finda")
    {
      /*
        Since navigating to a #finda will cause you to click a #finda,
        which will itself cause a popstate that could trigger a #finda
        navigation (ad infinitum),  this will remove that possibility
        by making the 'new' route the same as the old route, thereby
        going nowhere if pushStateLOck is on,  ie, going nowhere if
        the window history is already changing / the page is already
        navigating

        TODO This possible can wrap ALL navigation in popstate safely
        and double as a safeguard from any sort of navigation cascades 
      */
      if(routing.pushStateLock)
      {
        newDataRoute = oldDataRoute;
      }
    }
    let oldDataRoute   = routing.currState;
    debugLog("Old: " + JSON.stringify(oldDataRoute));
    debugLog("New: " + JSON.stringify(newDataRoute));
    routing.fromRouteToRouteWithoutAffectingHistory(oldDataRoute,newDataRoute);
  });

  /***************************************************************
   * Options
   *
   * All stuff dealing with saving options to persist after pageloads
   * TODO: 'wire' this to the page;  make the options themselves actually
   *       use these functions to update the url with options, and load them
   *       on page url, or remove all of this.
   ***************************************************************/
  /*
   * An enum for the different options you can check
   Example
   If you click guide,  the first tab will ask you to choose between
   'Assessments   []'
   'Medical Detox []'
   'Outpatient    []'
   'Residential   []'
   If you wanted to store in a variable that you had checked assessments,
   you might write
   'let searchType = SearchOption.TYPE.ASSESSMENTS';
  */
  const SearchOption = {
    TYPE : {
      ASSESSMENTS : 1,
      MEDICAL_DETOX : 2,
      OUTPATIENT : 3,
      RESIDENTIAL : 4
    },
    OUTPATIENT: {
      INTENSIVE_OUTPATIENT : 1,
      MEDICATION_ASSISTED_TREATMENT : 2,
      COUNSELING : 3
    },
    GENDER: {
      FEMALE : 1,
      MALE : 2
    },
    PREGNANCY : {
      NO: 1,
      YES: 2
    },
    AGE: {
      MINOR : 1,
      ADULT : 2
    },
    INSURANCE : {
      GOVERNMENT_FUNDED : 1,
      MEDICAID : 2,
      MEDICARE : 3,
      NO_FEE : 4,
      SLIDING_SCALE : 5,
      OTHER_HEALTH_INSURANCE : 6,
      SELF_PAY : 7
    }
  };
  /*
   * An example set of options to test from 
   */
  let testOptions = { "facility_type" : SearchOption.TYPE.MEDICAL_DETOX ,
                      "out_patient" : SearchOption.OUTPATIENT.INTENSIVE_OUTPATIENT,
                      "gender" :   SearchOption.GENDER.FEMALE,
                      "pregnancy" : SearchOption.PREGNANCY.YES,
                      "age" : SearchOption.AGE.MINOR,
                      "insurance" : SearchOption.INSURANCE.MEDICARE
                    };
  let self = this;

  /****************************************************************************
   *
   *  Saved options
   *
   ****************************************************************************/

  function encodeOptionsBase64(options)
  {
    return encodeURI(btoa(JSON.stringify(options)));
  }
  function decodeOptionsBase64(base64)
  {
    return JSON.parse(atob(decodeURI(base64)));
  }
  /*
   * The options are encoded in the window url as
   'http://getHelpLex../#/residential?data=sdfdsafsgsag

   The data=asdkfjsald are the options, converted into base64

   This function will just extract that data value
  */
  function getEncodedOptionsFromWindowUrl()
  {
    let urlSearch = window.location.search;
    let searchParams = new URLSearchParams(urlSearch);
    let data    = searchParams.get("data");
    return data;
  }
  debugLog("Test: getEncodedOptionsFromWindowUrl?");
  debugLog(getEncodedOptionsFromWindowUrl() === "eyJmYWNpbGl0eV90eXBlIjoyLCJvdXRfcGF0aWVudCI6MSwiZ2VuZGVyIjoxLCJwcmVnbmFuY3kiOjIsImFnZSI6MSwiaW5zdXJhbmNlIjozfQ==" ? "PASS" : "FAIL");
  /*
   * This function will extract, and then decode that data value
   into a json of options
   Example:
   { type: SearchOption.TYPE.ASSESSMENTS ,
   gender: SearchOption.GENDER.MALE, ..
   }
  */
  function getOptionsFromWindowUrl()
  {
    return decodeOptionsBase64(getEncodedOptionsFromWindowUrl());
  }
  //Test below
  function updateEncodedOptionsWithOption(encoded,key,value)
  {
    let options = decodeOptionsBase64(encoded);
    options[key] = value;
    return encodeOptionsBase64(options);
  }

  function setEncodedOptionsinWindowUrl(encoded)
  {
    let url = new URL(window.location.href);
    url.searchParams.set("data",encoded);
    window.history.pushState({},'',url.search);
    //      window.location.search = url.search;
  }
  function updateWindowOptionsUrlWithOption(key,value)
  {
    
  }


  debugLog(testOptions);
  debugLog(encodeOptionsBase64(testOptions));
  debugLog(decodeOptionsBase64(encodeOptionsBase64(testOptions)));
  //    setEncodedOptionsinWindowUrl(encodeOptionsBase64(testOptions));

  /************************************************************************
   * Routes
   *
   * All the route utilities that create this idea of a route
   ************************************************************************/

  /************************************************************************
   * Route parsers (read / write routes from url,  extract info from route) 
   ************************************************************************/
  ////
  function getRouteSearch(route)
  {
    return route.substring(route.indexOf("?"));
  }
  let testRoute = "#/progress/1?cat=12&data=dog";
  debugLog("Test: getRouteSearch query string?");
  debugLog(testRoute + "," + getRouteSearch(testRoute));
  debugLog(getRouteSearch(testRoute) === "?cat=12&data=dog" ? "PASS" : "FAIL");
  ////
  function getRouteData(route)
  {
    let searchParams = new URLSearchParams(route);
    let data = searchParams.get("data");
    return data;
  }
  debugLog("Test: getRouteData?");
  debugLog(testRoute + "," + getRouteData(testRoute));
  debugLog(getRouteData(testRoute) === "dog" ? "PASS" : "FAIL");

  ////
  function getRouteUrl(route)
  {
    let hasGetVars = route.indexOf("?") != -1;
    if(!hasGetVars)
    {
      return route;
    }
    return route.substring(0,route.indexOf("?"));
  }
  debugLog("Test: getRouteUrl");
  debugLog(testRoute + "," + getRouteUrl(testRoute));
  debugLog(getRouteUrl(testRoute) === "#/progress/1" ? "PASS" : "FAIL");
  ////
  function getRouteFromUrl(fullUrl)
  {
    let url = new URL(fullUrl).href;
    if(url.indexOf("#") == -1)
    {
      return "";
    }
    return url.substring(url.indexOf("#")) || "";
  }
  let testHref = "http://site-js-gethelplex.test/" + testRoute;
  debugLog("Test: getRouteFromUrl");
  debugLog(testHref + "," + getRouteFromUrl(testHref));
  debugLog(getRouteFromUrl(testHref) === testRoute ? "PASS" : "FAIL");
  ////
  function getRouteFromWindowUrl()
  {
    return getRouteFromUrl(window.location.href);
  }
  function setRouteInWindowUrl(route)
  {
    window.history.replaceState({},'',route);
  }
  function replaceDataRouteInWindowUrl(dataRoute)
  {
    routing.currState = dataRoute;
    window.history.replaceState(dataRoute,'',dataRouteToRoute(dataRoute));
  }
  this.pushDataRouteInWindowUrl = function(dataRoute)
  {
    debugLog("DATA ROUTE: " + JSON.stringify(dataRoute));
    debugLog("Route: " + dataRouteToRoute(dataRoute));
    routing.currState = dataRoute;
    window.history.pushState(dataRoute,'',dataRouteToRoute(dataRoute));
  };
  /*
    Push, if the pushStateLock is false
  */
  this.tryPushDataRouteInWindowUrl = function(dataRoute)
  {
    
    if(!routing.pushStateLock)
    {
      // For instances of routes like assessments themselves functioning by clicking
      // view facilities first
      if(isAnyViewFacilitiesLikeRoute(dataRoute) && isAnyViewFacilitiesLikeRoute(routing.currState))
      {
        // If its facilities, we are losing specificity, and thus don't need
        // to change the url.  Otherwise, we are gaining specificity, so
        // let's refine the url 
        if(dataRoute.routeName != "facilities") {
          replaceDataRouteInWindowUrl(dataRoute);
        }
      }
      else {
        routing.pushDataRouteInWindowUrl(dataRoute);
      }
    }
  };
  this.pushRouteInWindowUrl = function(route)
  {
    debugLog("Route: " + route);
    debugLog("Data route: " + JSON.stringify(routeToDataRoute(route)));
    routing.currState = routeToDataRoute(route);
    window.history.pushState(routeToDataRoute(route),'',route);
  };

  function onPageFullLoad()
  {
    debugLog("CURR STATE: " + JSON.stringify(routing.currState));

    replaceDataRouteInWindowUrl(routing.currState);
    routing.fromRouteToRouteWithoutAffectingHistory(defaultCurrState,routing.currState);
    let bindRouteToSelector = function(selector,dataRoute) {
      $(document).on('click',selector,function(ev) {
        debugLog("Clicked: " + selector);
        routing.tryPushDataRouteInWindowUrl(dataRoute);
      });
    };
    /* Attach all the routes to buttons */
    bindRouteToSelector(assessmentsSelector, { routeName: "assessments", page: 1, data: routing.currState.data}); 
    // TODO add data to this
    bindRouteToSelector(medicalDetoxSelector, { routeName: "medical-detox", page: 0, data: routing.currState.data});
    bindRouteToSelector(residentialSelector, { routeName: "residential", page: 1, data: routing.currState.data});
    bindRouteToSelector(outpatientSelector, { routeName: "outpatient", page: 1, data: routing.currState.data});
    bindRouteToSelector(twelveStepProgramsSelector, { routeName: "twelve-step-programs", page: 0, data: routing.currState.data});

    bindRouteToSelector(guidedSearchSelector, { routeName: "guide", page: 1, data: routing.currState.data});

    bindRouteToSelector(feedbackSelector, { routeName: "feedback", page: 0, data: routing.currState.data});

    bindRouteToSelector(infoSelector, { routeName: "info", page: 0, data: routing.currState.data});
    bindRouteToSelector(viewFacilitiesSelector, { routeName: "facilities", page: 0, data: routing.currState.data});

  }
  let testRouteDataA = { routeName : "", route: "", page: 0 };
  let testRouteDataB = { route : "#/facilities", routeName: "facilities" };
  let testRouteDataC = { route : "#/guide/3", routeName: "guide", page: 3 };
  let testRouteDataD = {
    route : "#/facilities",
    routeName: "facilities",
    data: "ebebeb"
  };
  let testRouteDataE = {
    route : "#/guide/3",
    routeName: "guide",
    page: 3,
    data: "ababab"
  };

  let defaultCurrState = routeToDataRoute("");
  routing.currState = routeToDataRoute(getRouteFromWindowUrl());
  /*
    routeToDataRoute

    the 'dataRoute' is the internal, json representation of a route
    passed around throughout the program 
    Schema:
    {

    route: String (contains).
    Deprecated, as it is just a summary of the structure itself,
    and will get out of sync.

    routeName: "" | "guide" | "facilities" | "twelve-step-programs",

    page: 0 - 5 (also 0 if the page has no pages) 
    };
  */
  function routeToDataRoute(origRoute)
  {
    let route = getRouteUrl(origRoute);
    let data  = getRouteData(origRoute); 
    /* Parsers
     *
     * Each of these sections takes the route, such as '/#/residential/5
     * and tries to parse it.  Each section typical is looking for a
     * set of different routes that follow the same pattern.

     * If the route matches the pattern a section is looking for, it will
     * extract all the useful info (the route name, and possibly the page)
     * and will make the data route mentioned in the comment above this fn name,
     * and return it.

     /***************************************************************************/
    /*
     * This will handle routes that look like #/{type} and #/{type}/{pageNumber}
     */

    /* Takes the navigationRoutes  (["residential","guide","outpatient"])...
       and creates
       residential|guide|outpatient..
       To be used in our regex
    */
    let routeNameRegexStr = "[^/]+";
    /* The regex for extracting this kind of route */
    let routeRegex   = new RegExp("#\/(" + routeNameRegexStr + ")(\/(1|2|3|4|5|6))?");
    let routePageNum = 0;
    let routeName = "guide";
    let routeMatch = route.match(routeRegex);
    if(routeMatch){
      routeName = routeMatch[1];
      if(routeMatch[3])
      {
        routePageNum = parseInt(routeMatch[3]);
      }
      return { route: route, routeName: routeName, page: routePageNum , data: data};
    }
    /****************************************************************************
     *
     * Edge case: the preexisting #finda-n routes
     */
    let findaRegex = /#finda-(\d+)/;
    let findaMatch = route.match(findaRegex);
    if(findaMatch)
    {
      let findaName  = findaMatch[0];
      let findaNum   = parseInt(findaMatch[1]) || 0;
      return { route: route, routeName: "finda" , page: findaNum , data: data };
    }
    /****************************************************************************/
    /*
     * The home route 
     */
    let homeRegex   = /^(#\/)?$/;
    //let guideNum = 6;
    let homeMatch = route.match(homeRegex);
    if(homeMatch)
    {
      return { route: route, routeName: "", page: 0 , data: data};
    }
    
  }
  debugLog("Test: routeToDataRoute");
  let testRouteToData1 = "#/facilities";
  let testRouteToData1Res = routeToDataRoute(testRouteToData1);
  debugLog(testRouteToData1 + " , " + JSON.stringify(testRouteToData1Res));
  debugLog(jsonEquals(testRouteToData1Res,{ route: testRouteToData1, routeName: "facilities", page: 0, data : null }) ? "PASS" : "FAIL");
  let testRouteToData2 = "#/residential";
  let testRouteToData2Res = routeToDataRoute(testRouteToData2);
  debugLog(testRouteToData2 + " , " + JSON.stringify(testRouteToData2Res));
  debugLog(jsonEquals(testRouteToData2Res,{ route: testRouteToData2, routeName: "residential", page: 0, data : null }) ? "PASS" : "FAIL");

  let testRouteToData3 = "#/residential/3";
  let testRouteToData3Res = routeToDataRoute(testRouteToData3);
  debugLog(testRouteToData3 + " , " + JSON.stringify(testRouteToData3Res));
  debugLog(jsonEquals(testRouteToData3Res,{ route: testRouteToData3, routeName: "residential", page: 3, data : null }) ? "PASS" : "FAIL");

  let testRouteToData4 = "#finda-543";
  let testRouteToData4Res = routeToDataRoute(testRouteToData4);
  debugLog(testRouteToData4 + " , " + JSON.stringify(testRouteToData4Res));
  debugLog(jsonEquals(testRouteToData4Res,{ route: testRouteToData4, routeName: "finda", page: 543, data : null }) ? "PASS" : "FAIL");

  //This is a 'last page' route, to be tested in the fromRouteToRoute
  let testRouteToData5 = "#/residential/4";
  let testRouteToData5Res = routeToDataRoute(testRouteToData5);
  debugLog(testRouteToData5 + " , " + JSON.stringify(testRouteToData5Res));
  debugLog(jsonEquals(testRouteToData5Res,{ route: testRouteToData5, routeName: "residential", page: 4, data : null }) ? "PASS" : "FAIL");

/********************************************************************************
 * These tests depend upon the existence of other tests done above after the data route functions are made.

   TODO Move the tests somewhere separately altogether, and move these functions
   to the top of the program underneath the lookup tables 
 *
/******************************************************************************/
  /** Conditions **/
  let isNavigationRoute =
      (dataRoute) =>
      navigationRoutes.indexOf(dataRoute.routeName) >= 0;
  debugLog("Test isNavigationRoute?");
  debugLog(JSON.stringify(testRouteToData3Res) + "," + isNavigationRoute(testRouteToData3Res));
  debugLog(isNavigationRoute(testRouteToData3Res) ? "PASS" : "FAIL");
  debugLog(JSON.stringify(testRouteToData2Res) + "," + isNavigationRoute(testRouteToData2Res));
  debugLog(isNavigationRoute(testRouteToData2Res) ? "PASS" : "FAIL");
  
  let isViewFacilitiesRoute =
      (dataRoute) =>
      // If this is in the 'viewFacilities' routes array
      viewFacilitiesRoutes.indexOf(dataRoute.routeName) >= 0;
  let isViewFacilitiesOfNavigationRoute =
      (dataRoute) =>
      // Or if this is the last page of a navigation route (which shows facilities)
      (isNavigationRoute(dataRoute) && dataRoute.page >= navigationRouteLastPageLookup[dataRoute.routeName]);
  /*
    'view facilities like' = view facilities / view facilities of navigation
  */
  let isAnyViewFacilitiesLikeRoute =
      (dataRoute) =>
      (isViewFacilitiesRoute(dataRoute) || isViewFacilitiesOfNavigationRoute(dataRoute));
  debugLog("Test isViewFacilitiesRoute?");
  testFn("isViewFacilitiesRoute",
         isViewFacilitiesRoute,
         // #/facilities 
         [testRouteToData1Res],
         true);
  // #/residential/3
  debugLog(JSON.stringify(testRouteToData3Res) + "," + isViewFacilitiesRoute(testRouteToData3Res));
  debugLog(!isViewFacilitiesRoute(testRouteToData3Res) ? "PASS" : "FAIL");
  // #/residential
  debugLog(JSON.stringify(testRouteToData2Res) + "," + isViewFacilitiesRoute(testRouteToData2Res));
  debugLog(!isViewFacilitiesRoute(testRouteToData2Res) ? "PASS" : "FAIL");
  // #/residential/4 
  debugLog(JSON.stringify(testRouteToData5Res) + "," + isViewFacilitiesRoute(testRouteToData5Res));
  debugLog(!isViewFacilitiesRoute(testRouteToData5Res) ? "PASS" : "FAIL");

  //isViewFacilitiesOfNavigationRoute
  testFn("isViewFacilitiesOfNavigationRoute",
         isViewFacilitiesOfNavigationRoute,
         // #/residential/4 
         [testRouteToData5Res],
         true);
  // #/residential
  testFn("isViewFacilitiesOfNavigationRoute",
         isViewFacilitiesOfNavigationRoute,
         // #/residential 
         [testRouteToData2Res],
         false);
  testFn("isViewFacilitiesOfNavigationRoute",
         isViewFacilitiesOfNavigationRoute,
         // #/facilities 
         [testRouteToData1Res],
         false);
  
  //isAnyViewFacilitiesLikeRoute?"
  testFn("isAnyViewFacilitiesLikeRoute?",
         isAnyViewFacilitiesLikeRoute,
         // #/residential 
         [testRouteToData2Res],
         false);
  testFn("isAnyViewFacilitiesLikeRoute?",
         isAnyViewFacilitiesLikeRoute,
         // #/residential 
         [testRouteToData1Res],
         true);
  testFn("isAnyViewFacilitiesLikeRoute?",
         isAnyViewFacilitiesLikeRoute,
         // #/residential/4 
         [testRouteToData5Res],
         true);

  /*
   * Takes our data route and converts it back into a route

   * Example:
   *
   * let dataRoute = { routeName: "residential" , page: 3,  data: null }
   * let route     = dataRouteToRoute(dataRoute)
   *
   * Route here become "#/residential/3" 
   */
  function dataRouteToRoute(dataRoute)
  {
    let retval = "#/";
    /*
      Edge case: #finda-n
    */
    if(dataRoute.routeName == "finda")
    {
      return "#finda-" + dataRoute.page;
    }
    
    if(dataRoute.routeName == "")
    {
      retval = "/";
    }
    
    retval += dataRoute.routeName;
    // If our route is in the list of navigation routes
    if(navigationRoutes.indexOf(dataRoute.routeName) >= 0)
    {
      retval += "/" + dataRoute.page;
    }
    
    if(dataRoute.data)
    {
      retval += "?data=" + dataRoute.data;
    }
    return retval;
  }
  debugLog("Test: dataRouteToRoute");
  debugLog(JSON.stringify(testRouteDataA) + "," + dataRouteToRoute(testRouteDataA));
  debugLog(dataRouteToRoute(testRouteDataA) === "" ? "PASS" : "FAIL");
  debugLog(JSON.stringify(testRouteDataB) + "," + dataRouteToRoute(testRouteDataB));
  debugLog(dataRouteToRoute(testRouteDataB) === "#/facilities" ? "PASS" : "FAIL");
  debugLog(JSON.stringify(testRouteDataD) + "," + dataRouteToRoute(testRouteDataD));
  debugLog(dataRouteToRoute(testRouteDataD) === "#/facilities?data=ebebeb" ? "PASS" : "FAIL");
  debugLog(JSON.stringify(testRouteDataE) + "," + dataRouteToRoute(testRouteDataE));
  debugLog(dataRouteToRoute(testRouteDataE) === "#/guide/3?data=ababab" ? "PASS" : "FAIL");
  let testRouteDataF = { routeName: "finda" , page: 712 , data: null};
  debugLog(JSON.stringify(testRouteDataF) + "," + dataRouteToRoute(testRouteDataF));
  debugLog(dataRouteToRoute(testRouteDataF) === "#finda-712" ? "PASS" : "FAIL");
  /*
    This is going to be a massive function no matter which way you cut it
    because you basically have to wire up all the 'transitions' from one
    route to another.

    Yes,  you could reduce it to just the data involved, like

    'transitions = { "facilities" : { "home" : function() { do this...}}}'
    (and then have a function that takes this information and interprets it)
    in place of what we have now, which is something like 

    if(beginRouteBlah === 'facilities')
    if(endRoute === 'home')
    do this ...
    
    But then it gets hairier when you start to group multiple transitions into
    one block of code (or as an example):

    {"facilities" : { ALL-POSSIBLE-POPUP-TRANSITIONS : do this }.

    Yes,  you could still come up with a langauge for this, say by actually writing

    {"facilities" : { "popup-transitions" : ...}

    Where later on, you will interpret "popup-transitions" to be a group of
    transitions, but then instead of removing complexity, you've moved it into
    the interpreter (although I'm not necessarily saying I don't prefer that;
    data / a dsl / an interface for expressing what you want, and moving the
    implementation into another function for interpretation. Hell, maybe that
    would be better in the long run, as once the 'interpreter' becomes stable,
    you only have to worry about expressing what you want in your dsl, and
    debugging the simplified dsl). Regardless, I think just using a
    straightforward tree of if statements here is the most straightforward,
    and most 'accessible' to other programmers, especially since this
    currently has such a limited scope.

    @TODO
    Implement all the transitions in a more low level, less hacky way
    
    fromRouteToRoute

    @beginRouteData
    a dataRoute  ( { routeName: "residential" , page: 3, data: null} )
    @endRouteData
    a dataRoute  ( { routeName: "facilities" , page: 0, data: null} )
  */
  function fromRouteToRoute(beginRouteData,endRouteData)
  {
    let beginRouteLastPage = navigationRouteLastPageLookup[beginRouteData.routeName];


    /*
      if(jsonEquals(beginRouteData,endRouteData))
      {
      //Do nothing
      return;
      }
      /********************************************************************
      *
      * Shortcuts (Example: 'for all end routes ... for all start routes ....')
      *           (Example: Popups -> Anything,     Anything -> Residential )
      *
      *********************************************************************
      */
    /************************************************************
     * Popup 'shortcuts'
     *
     * END ROUTE
     *************
     *  Anything -> POPUP ROUTE
     *  If our endroute is a popup,  then we pretty much always know
     *  we want to just 'go home' and then click them, so let's do that here

     * Skip shortcut if beginning and destination is a popup;
     * that will be handled by our last start handler at bottom
     ************************************************************/
    if(popupRoutes.indexOf(endRouteData.routeName) >= 0 &&
       popupRoutes.indexOf(beginRouteData.routeName) < 0)
    {
      fromRouteToRoute(beginRouteData,defaultCurrState);
      let selector = selectorLookupTable[endRouteData.routeName];
      debugLog("Selector: " + selector);
      $(selector).trigger("click");
      
    }
    else if(beginRouteData.routeName === "finda")
    {
      /* FINDA-N -> FINDA-M   (just click the new one) */
      if(endRouteData.routeName === "finda")
      {
        let findaSelector = "#finda-" + endRouteData.page;
        $(findaSelector).trigger("click");
      }
      /* FINDA-N -> (view facilities)
         else if(isAnyViewFacilitiesLikeRoute(endRouteData))
         {
         }
         /* FINDA-N -> Anywhere else */
      else { 
        window.location = endRouteData.route;
        window.location.reload();
      }

    }
    /* Finda shortcut
     * ALL FINDA ENDROUTES
     *********************
     * ??(ALL) -> #finda-n
     */
    else if(endRouteData.routeName === "finda")
    {
      let findaSelector = "#finda-" + endRouteData.page;
      if(beginRouteData.routeName !== "finda" &&
         !(viewFacilitiesRoutes.indexOf(beginRouteData.routeName) >= 0) &&
         //Or if we are on a navigation route, but our page is = the last page,
         //meaning we are actually on the view facilities page 
         !(navigationRoutes.indexOf(beginRouteData.routeName) >= 0 && beginRouteData.page >= beginRouteLastPage))
      {
        //Get us to the home
        fromRouteToRoute(beginRouteData,defaultCurrState);
        fromRouteToRoute(defaultCurrState,routeToDataRoute("#/facilities"));
      }
      $(findaSelector).trigger("click");
    }
    /* Finda shortcut
     * ALL FINDA START ROUTES
     * ***********************
     *  FINDA-n -> ??(ALL)
     */
    
    /******************************************************************
     * End shortcuts 
     ******************************************************************
     */
    
    /************************************************************
     * START ROUTE
     **************************************************************
     * HOME
     *
     *
     **************************************************************/
    else if(beginRouteData.routeName === "")
    {
      /************************************************************
       * END ROUTE
       **************************************************************
       * HOME -> MEDICAL-DETOX | RESIDENTIAL | OUTPATIENT | GUIDE 
       **************************************************************/
      // If our route is in the list of navigation routes
      // (medical-detox, residential , etc..)
      if(isNavigationRoute(endRouteData))
      {
        let selector = selectorLookupTable[endRouteData.routeName];
        let guideNum = endRouteData.page;
        $(selector).trigger("click");
        for(let i = 0; i < guideNum - 1; i++)
        {
          $(nextButtonSelector).trigger("click");
        }
      }
      /************************************************************
       * END ROUTE
       **************************************************************
       * HOME -> FACILITIES | ASSESSMENTS
       **************************************************************/
      if(isViewFacilitiesRoute(endRouteData)) {
        let currPage = beginRouteData.page;
        let selector = selectorLookupTable[endRouteData.routeName];
        for(let i = 0; i < currPage; i++)
        {
          $(prevButtonSelector).trigger("click");
        }
        $(selector).trigger("click");
      }
      /************************************************************
       * END ROUTE
       ************************************************************
       * HOME -> HOME (do nothing)
       ************************************************************/
      if(endRouteData.routeName === "")
      {
      }
      /* END ROUTE ************************************************/

    }

    /************************************************************
     * START ROUTE
     **************************************************************
     * MEDICAL-DETOX | RESIDENTIAL | OUTPATIENT | GUIDE 
     *
     *
     **************************************************************/
    // If our route is in the list of navigation routes
    else if(isNavigationRoute(beginRouteData)
            && beginRouteData.page < beginRouteLastPage)
    {
      /************************************************************
       * END ROUTE
       *
       * MED/RES/OUTP/GUIDE -> HOME (click back)
       **************************************************************/
      if(endRouteData.routeName === "")
      {
        let page = beginRouteData.page;
        for(let i = 0; i < page; i++)
        {
          $(prevButtonSelector).trigger("click");
        }
      }
      /* END ROUTE ************************************************/

      
      /************************************************************
       * END ROUTE
       *
       * MED/RES/OUTP/GUIDE -> other MED/RES/OUTP/GUIDE
       **************************************************************/
      if(isNavigationRoute(endRouteData))
      {
        // If we are on the same navigation page, we just need to go forward
        // or back to the new proper page
        if(beginRouteData.routeName == endRouteData.routeName)
        {
          let guideDiff = Math.abs(endRouteData.page - beginRouteData.page);
          let properSelector = endRouteData.page < beginRouteData.page ?
              prevButtonSelector :
              nextButtonSelector;
          //alert(guideDiff + " , " + properSelector);
          for(let i = 0; i < guideDiff; i++)
          {
            $(properSelector).trigger("click");
          }
        }
        // Else, go back and then click manually forward through the right
        // navigation link
        else
        {
          //Go back
          let currPage = beginRouteData.page;
          for(let i = 0; i < currPage; i++)
          {
            $(prevButtonSelector).trigger("click");
          }
          let pageToGoto = endRouteData.page;
          let properSelector = selectorLookupTable[endRouteData.routeName];
          $(properSelector).trigger("click");
          for(let i = 0; i < pageToGoto - 1; i++)
          {
            $(nextButtonSelector).trigger("click");
          }
        }
      }
      /* END ROUTE ************************************************/

      /************************************************************
       * END ROUTE
       *
       * MED/RES/OUTP/GUIDE -> facilities | assessments | medical-detox
       **************************************************************/
      if(isViewFacilitiesRoute(endRouteData)) {
        //TODO add assessment
        let currPage = beginRouteData.page;
        let selector = selectorLookupTable[endRouteData.routeName];
        for(let i = 0; i < currPage; i++)
        {
          $(prevButtonSelector).trigger("click");
        }
        $(selector).trigger("click");
      }
      /* END ROUTE ************************************************/
    }
    /************************************************************
     * START ROUTE
     **************************************************************
     * FACILITIES | GUIDE (LAST PAGE) | RESIDENTIAL (LAST PAGE) |
     * ASSESSMENTS | OUTPATIENT (LAST PAGE) | RESIDENTIAL (LAST PAGE)
     *
     * 
     **************************************************************/
    //If we are one of the 'view facilities' like routes
    else if(isAnyViewFacilitiesLikeRoute(beginRouteData))
    {
      if(endRouteData.routeName === "finda")
      {
        
      }
      /***********************************************************
       * END ROUTE
       *
       * Everything. Just refresh 
       ***********************************************************/
      window.location = endRouteData.route;
      window.location.reload();
      /**END ROUTE ******************************************************/
    }
    /************************************************************
     * START ROUTE
     **************************************************************
     * popup routes 
     * (twelve-step-programs | info | feedback) 
     *
     **************************************************************/
    else if(popupRoutes.indexOf(beginRouteData.routeName) >= 0)
    {
      /*
        window.location = endRouteData.route;
        window.location.reload();
      */
      let popupModal = popupModalSelectorLookup[beginRouteData.routeName];
      $(popupModal).modal("hide");
      fromRouteToRoute(defaultCurrState,endRouteData);
    }
  }
  /*
    I don't see any reason why 'fromRouteToRoute' would ever need to be called
    while affecting history, but regardless,  the two ideas are decoupled

    Also updates currState
  */
  routing.fromRouteToRouteWithoutAffectingHistory = function(beginRouteData,endRouteData)
  {
    routing.pushStateLock = true;
    routing.currState = endRouteData;
    fromRouteToRoute(beginRouteData,endRouteData);
    routing.pushStateLock = false;
  };
  /*
    
   */
  debugLog(encodeOptionsBase64(testOptions));
  $(document).ready(function()
                    {
                      let viewFacilitiesSelector = "button:contains('Guided Search')";//"a:contains('View Facilities')";
                      let other = "button[data-facility-type='assessment_offered']";
                      onSelectorAppearance(viewFacilitiesSelector,500,onPageFullLoad);
                    });

  /*
   * Emulates an event that fires when an element appears
   *
   * Mostly used to, say,  inject options when they appear
   (Example being checking 'Assessments' on the first tab of
   guide when that tab appears)

   Example:
   onSelectorAppearance(".btn.help",500,function(selector) { alert("Help button has been created.");});

   500 here is how often the program will check for the creation of the element

   @ele
   The element to check for
   @delay
   how often to check to see if this element exists
   @callback
   what to do when you found it.  Takes one argument, the selector
   in question 
  */
  function onSelectorAppearance(ele,delay,callback)
  {
    let retval = setInterval(function() {
      if($(ele).length) {
        clearInterval(retval);
        callback(ele);
      }
    },delay);
    return retval;
  }
  /*
   * Waits for multiple selectors to exist
   * Note: to be deprecated,  possibly can be removed already
   */
  function onSelectorsAppearance(eles,delay,callback)
  {
    if(eles.length === 1)
    {
      onSelectorAppearance(eles[0],500,callback);
    }
    onSelectorAppearance(eles[0],500,(ele) => {
      onSelectorsAppearance(eles.slice(1), delay,callback);
    });
  }
  /*
   *
   */
  function tryInjectOptions(options)
  {
    //We will wait on these
    let facetTypes = ['facility_type', 'out_patient','gender','pregnancy','age','insurance'];

    facetTypes.forEach(function(facetType) {
      let facetSelector = ".facet-form[data-facet='"+facetType+"']";
      debugLog("onSelectorAppearance($(" + facetSelector + ",500,funct");
      onSelectorAppearance(facetSelector,500,function() {
        debugLog("We get here");
        let $faceInput = $(facetSelector + " input:eq("+(options[facetType] - 1)+")");
        $faceInput.trigger("click");
      });
    });

  }
});
