/**
 * Created by drichards on 4/28/17.
 */



// Variables
var width = 500;
var height = 500;
var radius = Math.min(width, height) / 2;
var arc;
var allTopicsData;
var allTextsData;
var slice;
var newSlice;
var root;
var currentCorpus;
var color = d3.scaleLinear().domain([0, 0.5, 1]).range(['#337ab7', '#d3d3d3', '#464545']);
var corpusA = 'Jonah';  // These variable names bind us to the buttonGroupIDs
var corpusB = 'Proverbs2';  // And the variable values must correspond to the file name
var corpusC = 'Jonah2';  // And these values are used for the buttonGroup labels.

// Set the labels on the Corpus choice buttons
d3.select("#corpusA").html(corpusA);
d3.select("#corpusB").html(corpusB);
d3.select("#corpusC").html(corpusC);

// Size our <svg> element, add a <g> element, and move translate 0,0 to the center of the element.
var g = d3.select("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

// Create our sunburst data structure and size it.
var partition = d3.partition()
    .size([2 * Math.PI, radius]);

// Get files, produce visuals, set up event handlers
changeSelectedCorpus();
d3.selectAll("input[name=topTopicsSelect]").on("click", showTopTopics);
d3.selectAll("input[name=dateSelect]").on("click", showDate);
d3.selectAll("button.corpus").on("click", changeSelectedCorpus);

/**
 * Draw the sunburst
 * @param data {json} the topic data (parameterized in case we want to filter before drawing)
 */
function drawSunburst(data) {

    // Find the root node, calculate the node.value, and sort our nodes by node.value
    root = d3.hierarchy(data);

    // Determines size of each slice based on the topSize
    // TODO: Violates DRY (this logic exists below) -- but maybe that's okay?
    if (document.getElementById("top5").checked) {
        root.sum(function (d) { d.topSize = (d.rank <= 5) ? d.size : 0; return d.topSize; })
        .sort(function (a, b) { return b.value - a.value; });
    } else if (document.getElementById("top10").checked) {
        root.sum(function (d) { d.topSize = (d.rank <= 10) ? d.size : 0; return d.topSize; })
        .sort(function (a, b) { return b.value - a.value; });
    } else {
        root.sum(function (d) { d.topSize = d.size; return d.topSize; })
        .sort(function (a, b) { return b.value - a.value; });
    }

    // Calculate the size of each arc; save the initial angles for tweening.
    partition(root);
    //noinspection JSUnresolvedFunction
    arc = d3.arc()
        .startAngle(function (d) { d.x0s = d.x0; return d.x0; })
        .endAngle(function (d) { d.x1s = d.x1; return d.x1; })
        .innerRadius(function (d) { return d.y0; })
        .outerRadius(function (d) { return d.y1; });

    // Add a <g> element for each node; create the slice variable since we'll refer to this selection many times
    slice = g.selectAll("g.node").data(root.descendants(), function(d) { return d.data.name; });
    // .enter().append('g').attr("class", "node");
    newSlice = slice.enter().append("g").attr("class", "node").merge(slice);
    slice.exit().remove();


    // Append <path> elements and draw lines based on the arc calculations. Last, color the lines and the slices.
    slice.selectAll("path").remove();
    newSlice.append("path").attr("display", function (d) { return d.depth ? null : "none"; })
        .attr("d", arc)
        .style("stroke", "#fff")
        //.style("fill", function (d) { return color((d.children ? d : d.parent).data.name); })
        .style("fill", function (d) { return d.parent ? color(d.x0 / 6.28) : "white"; })
        .attr("display", function(d) { return d.depth ? null : "none"; })
        .append("title").text(function (d) { return d.data.name; }) ;

    // Populate the <text> elements with our data-driven titles.
    slice.selectAll("text").remove();
    newSlice.append("text")
        .attr("dx", function(d) { return (d.parent ? "-30" : ""); } )  // "-20" for rim labels
        .attr("dy", function(d) { return (d.parent ? ".25em" : "-3em"); }) // ".5em" for rim labels
        .text(function(d) { return d.data.name.split(" ").slice(0,2).join(" "); })
        .attr("display", function(d) { return d.depth ? null : "none"; });
    // TODO: Do we need to calc full sunburst first? Or can I wait on some for speed?

    // Adds in event handler for the slices
    newSlice.on("click", selectSlice);
}


/**
 * React to the user-selected slice: update visual and show texts, called by event handler
 * @param c {node} the clicked node
 */
function selectSlice(c) {

    var clicked = c;
    try {
        // get the path between the clicked node and the root
        var rootPath = clicked.path(root).reverse();
        rootPath.shift(); // remove root node from the array

        newSlice.style("opacity", 0.4);  // Wash out ALL slices
        newSlice.filter(function(d) {

            if (d === clicked && d.prevClicked) {
                // TURN OFF PATH & HIDE TEXTS/TITLES
                // We've click on the last slice clicked & this is the current node (as we loop through all of them).
                d3.select("#topicName").html("");
                d3.select("#topicDetails").html("");
                d3.selectAll(".cardsToggleAll").style("opacity", "0");
                d3.select("#sidebar").selectAll("div").remove();

                d.prevClicked = false;
                newSlice.style("opacity", 1);
                return true;

            } else if (d === clicked) { // Clicked a new node & this is the node: update path
                // UPDATE PATH, SHOW TEXTS
                var topic = c.data.name;
                d3.select("#topicName").html("Topic: '" + topic + "'");
                d3.selectAll(".cardsToggleAll").style("opacity", "1");

                showTexts(topic);
                var cards = document.getElementsByClassName("card");
                d3.select("#topicDetails").html(c.data.count + " mentions in " + cards.length + " texts");

                d.prevClicked = true;
                return true;
            } else {  // This is not the previously clicked or a newly clicked slice.
                //
                d.prevClicked = false;
                return (rootPath.indexOf(d) >= 0); // return true for this node if it's part of the path
            }
        }).style("opacity", 1);  // All of the above is to create an array for this style command
    } catch(e) {
        // newSlice.filter(function(d) { d.prevClicked = false; return true; }).style("opacity", 1);
        d3.selectAll(".node").style("opacity", 1);
        d3.select("#sidebar").selectAll("span").text("");
        d3.select("#sidebar").selectAll("div").remove();
    
    }
}

function showTexts(topic) {
    try {



        // Select the correct texts, and add to the sidebar...
        var divs = d3.select("#sidebar").selectAll("divs")
            .data(allTextsData.filter(function(text) {
                // TODO: Find a better way than looking for undefined...
                return typeof(text["topics"][topic]) != "undefined"; }));

        // TODO: What does merge do for me?
        var newDivs = divs.enter().append("divs").merge(divs)
            .html(function (d) {return d.htmlCard; });
        divs.exit().remove();

        // ******************* test code **************
        // Loop thru array and find texts...
        for (i = 0; i < allTextsData.length; i++) {
            // Stop when you find a text that has this "topic"
            // TODO: find a better way to do this test
            if (typeof(allTextsData[i]["topics"][topic]) != "undefined") {
                id = 'text_' + allTextsData[i]["id"];
                indexes = allTextsData[i]["topics"][topic];

                var card_text = document.getElementById(id);
                var cStr = card_text.innerText;

                for (t = 0; t < indexes.length; t++) {
                    var startIndex = indexes[t][0];
                    var endIndex = indexes[t][1];

                    cStr = cStr.slice(0, startIndex) + '<mark>' + cStr.slice(startIndex, endIndex) +
                        '</mark>' + cStr.slice(endIndex, cStr.length);

                    // console.log(indexes[i - 1][0] + ' ' + indexes[i - 1][1])

                }
                card_text.innerHTML = cStr;

            }

        }

    } catch (e) { }

}


function showDate() {
    alert("Not yet implemented: " + this.value);
}

/**
 * The user has selected a new corpus. Get new data files, the update the UI features
 */
function changeSelectedCorpus() {

    currentCorpus = (this.id ? window[this.id] : corpusA);

    getTopicsData();
    getTextsFile();
    selectSlice();

    // Update Page Labels
    d3.select("#topicName").html("");
    d3.select("#sidebar").selectAll("div").remove();

    // Update Corpus Buttons
    d3.selectAll(".corpus").classed("btn-primary", false);
    if (this.id === "corpusB") {
        d3.selectAll("#corpusB").classed("btn-primary", true);
    } else if (this.id === "corpusC") {
        d3.selectAll("#corpusC").classed("btn-primary", true);
    } else {
        d3.selectAll("#corpusA").classed("btn-primary", true);
    }

}

/**
 * Get a new Topics file
 */
function getTopicsData() {

    // this line assumes that we have a variable with the same name as the this.id assigned (at the top of the file).
    var corpusPath = "Data/Topics-" + currentCorpus + ".json";

    // Get the data from our JSON file
    d3.json(corpusPath, function(error, topicsData) {
        if (error) throw error;

        allTopicsData = topicsData;
        // var showTopicNodes = JSON.parse(JSON.stringify(topicsData));

        drawSunburst(allTopicsData);
        showTopTopics();
        d3.select("#corpusName").html(currentCorpus);
        d3.select("#corpusAsOf").html("As of " + allTopicsData.run_date.replace('2017-',''))

    });

}

/**
 * Get the correct Texts file based on the corpus button selection.
 */
function getTextsFile() {

    // IMP: Must have var with the same name as this.id (assigned at top of the file currently).
    var corpusPath = "Data/Texts-" + currentCorpus + ".json";

    // Get the data from our JSON file
    d3.json(corpusPath, function(error, textsData) {
        if (error) throw error;

        // Store texts data for use throughout this page.
        allTextsData = textsData;
    });

}


/**
 * Redraw the sunburst based on user selection of how many topics they want to see. We don't remove slices, we set their
 * size to 0. And we animate the transition. "Top 10" is the default, so this gets called even at initial build.
 */
function showTopTopics() {

    // Create a "topSize" variable to store the size (0 or actual) based on user selection. Return that to the d3.sum
    // function.
    // TODO: Currently I stash a "rank" in all slices. Maybe better to base below calc on either local *or* parent rank?
    if (document.getElementById("top5").checked) {
        root.sum(function (d) { d.topSize = (d.rank <= 5) ? d.size : 0; return d.topSize; });
    } else if (document.getElementById("top10").checked) {
        root.sum(function (d) { d.topSize = (d.rank <= 10) ? d.size : 0; return d.topSize; });
    } else {
        root.sum(function (d) { d.topSize = d.size; return d.topSize; });
    }

    // Recalculate partition data and then animate the redraw of both slices and text.
    partition(root);
    newSlice.selectAll("path").transition().duration(750).attrTween("d", arcTweenPath);
    newSlice.selectAll("text").transition().duration(750).attrTween("transform", arcTweenText)
        .attr("opacity", function (d) { return d.x1 - d.x0 > 0.07 ? 1 : 0; });
}


/**
 * When switching data: interpolate the arcs in data space.
 * @param {Node} a
 * @return {Number}
 */
function arcTweenPath(a) {

    var oi = d3.interpolate({ x0: a.x0s, x1: a.x1s }, a);

    function tween(t) {
        var b = oi(t);
        a.x0s = b.x0;
        a.x1s = b.x1;
        return arc(b);
    }

    return tween;
}


/**
 * When switching data: interpolate the text centroids and rotation.
 * @param {Node} a
 * @return {Number}
 */
function arcTweenText(a) {

    var oi = d3.interpolate({ x0: a.x0s, x1: a.x1s }, a);
    function tween(t) {
        var b = oi(t);
        return "translate(" + arc.centroid(b) + ")rotate(" + computeTextRotation(b) + ")";
    }
    return tween;
}


/**
 * Calculate the correct distance to rotate each label based on its location in the sunburst.
 * @param {Node} d
 * @return {Number}
 */
function computeTextRotation(d) {
    var angle = (d.x0 + d.x1) / Math.PI * 90;

    // Avoid upside-down labels
    //return (angle < 120 || angle > 270) ? angle : angle + 180;  // labels as rims
    return (angle < 180) ? angle - 90 : angle + 90;  // labels as spokes
}


function showFullText(cardID) {
    var card = d3.select("#card_" + cardID);
    if (card.classed("big")) {
        card.classed("big", false).style("height", "94px").style("overflow", "hidden");
    } else {
        card.classed("big", true).style("height", "300px").style("overflow", "auto");
    }
    return false;
}

function cardToggle(cardID) {
    var card = d3.select("#card_" + cardID);
    if (card.classed("big")) {
        card.classed("big", false).style("height", "94px").style("overflow", "hidden");
        card.select(".cardToggle").style("opacity", "0")
    } else {
        card.classed("big", true).style("height", "300px").style("overflow", "auto");
        card.select(".cardToggle").style("opacity", "1")
    }
    return false;
}

function cardToggleAll(contract) {
    var card = d3.selectAll(".card");
    if (contract) {
        card.style("height", "94px").style("overflow", "hidden");
    } else {
        card.style("height", "300px").style("overflow", "auto");
    }
    return false;
}
