(function() {

  var enums = ['var1', 'var2', 'var3', 'var4', 'var5'];
  var attributes = ['drive alone', 'carpool with 1 other',
    'carpool with 2 or more', 'take public transportation', 'walk'
  ]
  var expressed = enums[0];

  var yAxis, axis;

  //chart frame dimensions
  var chartWidth = window.innerWidth * 0.425,
    chartHeight = 460,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

  //create a scale to size bars proportionally to frame and for axis
  var yScale = d3.scaleLinear()
    .range([460, 0])
    .domain([0, 100]);

  window.onload = setMap()

  function setMap() {
    var width = window.innerWidth * 0.5,
      height = 460;

    //create new svg container for the map
    var map = d3.select("body")
      .append("svg")
      .attr("class", "map")
      .attr("width", width)
      .attr("height", height);


    var projection = d3.geoAlbers()
      .center([-16.36, 50.87])
      .rotate([93.78, 5.26, 0])
      .parallels([29.5, 45.5])
      .scale(180000.34)
      .translate([width / 2, height / 2]);

    var path = d3.geoPath()
      .projection(projection);

    var promises = [];
    promises.push(d3.json("data/tracts.json"));
    promises.push(d3.csv("data/data2.csv"));

    Promise.all(promises).then(function(values) {
      callback(values)
    });

    function callback(values) {
      var tracts = topojson.feature(values[0], values[0].objects.tracts).features;
      var csvData = values[1];

      tractsData = joinData(tracts, csvData);

      var colorScale = makeColorScale(csvData);
      setEnumerationUnits(tractsData, map, path, colorScale);
      createDropdown(csvData);
      setChart(csvData, colorScale);
    }
  }

  function makeColorScale(data) {
    var colorClasses = [
      "#f6eff7",
      "#bdc9e1",
      "#67a9cf",
      "#1c9099",
      "#016c59",

    ];

    //create color scale generator
    var colorScale = d3.scaleThreshold()
      .range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i = 0; i < data.length; i++) {
      var val = parseFloat(data[i][expressed]);
      domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d) {
      return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();

    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale;
  };

  //function to test for data value and return color
  function choropleth(props, colorScale) {
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (typeof val == 'number' && !isNaN(val)) {
      return colorScale(val);
    } else {
      return "#CCC";
    };
  };

  function setChart(csvData, colorScale) {

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
      .append("svg")
      .attr("width", chartWidth)
      .attr("height", chartHeight)
      .attr("class", "chart");

    //set bars for each province
    var bars = chart.selectAll(".bar")
      .data(csvData)
      .enter()
      .append("rect")
      .sort(function(a, b) {
        return b[expressed] - a[expressed]
      })
      .attr("class", function(d) {
        return "bar yc" + d.geoid;
      })
      .attr("width", chartInnerWidth / csvData.length - 1)
      .on("mouseover", highlight)
      .on("mouseout", dehighlight)
      .on("mousemove", moveLabel);
    var desc = bars.append("desc")
      .text('{"stroke": "none", "stroke-width": "0px"}');

    var chartTitle = chart.append("text")
      .attr("x", 40)
      .attr("y", 25)
      .attr("class", "chartTitle")
      .text("Percent of working population who " + expressed[3]);

    //create vertical axis generator
    yAxis = d3.axisLeft()
      .scale(yScale);

    //place axis
    axis = chart.append("g")
      .attr("class", "axis")
      .attr("transform", translate)
      .call(yAxis);

    //create frame for chart border
    var chartFrame = chart.append("rect")
      .attr("class", "chartFrame")
      .attr("width", chartInnerWidth)
      .attr("height", chartInnerHeight)
      .attr("transform", translate);

    //set bar positions, heights, and colors
    updateChart(bars, csvData.length, colorScale);
  };

  //function to create a dropdown menu for attribute selection
  function createDropdown(csvData) {
    var dropdown = d3.select("body")
      .append("select")
      .attr("class", "dropdown")
      .on("change", function() {
        changeAttribute(this.value, csvData)
      });
    //add initial option
    var titleOption = dropdown.append("option")
      .attr("class", "titleOption")
      .attr("disabled", "true")
      .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
      .data(enums)
      .enter()
      .append("option")
      .attr("value", function(d) {
        return d
      })
      .text(function(d) {
        return attributes[enums.indexOf(d)]
      });
  };
  //dropdown change listener handler
  function changeAttribute(attribute, csvData) {
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var tracts = d3.selectAll(".tract")
      .transition()
      .duration(1000)
      .style("fill", function(d) {
        return choropleth(d.properties, colorScale)
      });
    var bars = d3.selectAll(".bar")
      //re-sort bars
      .sort(function(a, b) {
        return b[expressed] - a[expressed];
      })
      .transition() //add animation
      .delay(function(d, i) {
        return i * 20
      })
      .duration(500);
    var maxV = d3.max(csvData, function(d) {
      return parseFloat(d[expressed])
    });
    if (maxV > 20) {
      maxV = 100
    } else {
      maxV = maxV + 3
    }
    yScale.domain([0, maxV]);
    yAxis.scale(yScale)
    axis.call(yAxis);
    updateChart(bars, csvData.length, colorScale);
  };

  function updateChart(bars, n, colorScale) {

    //position bars
    bars.attr("x", function(d, i) {
        return i * (chartInnerWidth / n) + leftPadding;
      })
      //size/resize bars
      .attr("height", function(d, i) {
        var h = 460 - yScale(parseFloat(d[expressed]));
        if (h > 0) {
          return h
        } else {
          return 0
        }
      })
      .attr("y", function(d, i) {
        return yScale(parseFloat(d[expressed])) + topBottomPadding;
      })
      //color/recolor bars
      .style("fill", function(d) {
        return choropleth(d, colorScale);
      });
    //at the bottom of updateChart()...add text to chart title
    var chartTitle = d3.select(".chartTitle")
      .text("Percent of working population who " + attributes[enums.indexOf(
        expressed)] + ' to work');
  };

  //function to highlight enumeration units and bars
  function highlight(props) {
    //change stroke
    var i;
    if (props.GEOID_Data) {
      i = props.GEOID_Data;
    } else {
      i = props.geoid
    }
    var selected = d3.selectAll(".yc" + i)
      .style("stroke", "red")
      .style("stroke-width", "2");
    setLabel(props);
  };

  function dehighlight(props) {
    var i;
    if (props.GEOID_Data) {
      i = props.GEOID_Data;
    } else {
      i = props.geoid
    }
    var selected = d3.selectAll(".yc" + i)
      .style("stroke", function() {
        return getStyle(this, "stroke")
      })
      .style("stroke-width", function() {
        return getStyle(this, "stroke-width")
      });

    function getStyle(element, styleName) {
      var styleText = d3.select(element)
        .select("desc")
        .text();

      var styleObject = JSON.parse(styleText);

      return styleObject[styleName];
    };
    d3.select(".infolabel")
      .remove();
  };

  function joinData(tracts, csvData, ) {
    for (i = 0; i < csvData.length; i++) {
      var currTract = csvData[i];
      var csvKey = currTract.geoid;

      for (j = 0; j < tracts.length; j++) {
        var jsonProps = tracts[j].properties;
        var jsonKey = jsonProps.GEOID_Data;

        if (jsonKey == csvKey) {
          enums.forEach(function(val) {
            jsonProps[val] = currTract[val]
          })
        }
      }
    }
    return tracts
  }

  function setEnumerationUnits(tracts, map, path, colorScale) {
    var tractsOutline = map.selectAll(".tracts")
      .data(tracts)
      .enter()
      .append("path")
      .attr("class", function(d) {
        return "tract yc" + d.properties.GEOID_Data;
      })
      .attr("d", path)
      .style("fill", function(d) {
        return choropleth(d.properties, colorScale);
      })
      .on("mouseover", function(d) {
        highlight(d.properties);
      })
      .on("mouseout", function(d) {
        dehighlight(d.properties);
      })
      .on("mousemove", moveLabel);
    var desc = tractsOutline.append("desc")
      .text('{"stroke": "#000", "stroke-width": "0.5px"}');
  }

  function setLabel(props) {
    var i, j;
    if (props.GEOID_Data) {
      i = props.GEOID_Data;
      j = props.NAME
    } else {
      i = props.geoid;
      j = props.name
    }
    //label content
    var labelAttribute = "<h1>" + props[expressed] +
      "%</h1><b>" + attributes[enums.indexOf(expressed)] + "</b>";

    var labelName = 'Tract ' + j;

    //create info label div
    var infolabel = d3.select("body")
      .append("div")
      .attr("class", "infolabel")
      .attr("id", props.i + "_label")
      .html(labelAttribute);

    var regionName = infolabel.append("div")
      .attr("class", "labelname")
      .html(labelName);
  };

  //function to move info label with mouse
  function moveLabel() {
    //get width of label
    var labelWidth = d3.select(".infolabel")
      .node()
      .getBoundingClientRect()
      .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
      y1 = d3.event.clientY - 75,
      x2 = d3.event.clientX - labelWidth - 10,
      y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1;

    d3.select(".infolabel")
      .style("left", x + "px")
      .style("top", y + "px");
  };

})()
