/**
 * Created by drichards on 4/28/17.
 */


/*
List of items
Title/Author. Text (first 50 words with elipsis)....
Left (icon) = link to source
Right (sentiment color)

Sort by: Time, Source, Sentiment, Title, Topic

Phase 2: Like, Junk

 */


// Variables
var width = 500;
var height = 500;
var radius = Math.min(width, height) / 2;
var color = d3.scaleOrdinal(d3.schemeCategory20b);
var corpus = "corpusA.json";


// Size our <svg> element, add a <g> element, and move translate 0,0 to the center of the element.
var g = d3.select('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

// Create our sunburst data structure and size it.
var partition = d3.partition()
    .size([2 * Math.PI, radius]);

getData();

function drawSunburst(data) {

    // Find the root node, calculate the node.value, and sort our nodes by node.value
    root = d3.hierarchy(data)
        .sum(function (d) { return d.size; })
        .sort(function (a, b) { return b.value - a.value; });

    // Calculate the size of each arc; save the initial angles for tweening.
    partition(root);
    arc = d3.arc()
        .startAngle(function (d) { d.x0s = d.x0; return d.x0; })
        .endAngle(function (d) { d.x1s = d.x1; return d.x1; })
        .innerRadius(function (d) { return d.y0; })
        .outerRadius(function (d) { return d.y1; });

    // Add a <g> element for each node; create the slice variable since we'll refer to this selection many times
    slice = g.selectAll('g.node').data(root.descendants(), function(d) { return d.data.name; }); // .enter().append('g').attr("class", "node");
    newSlice = slice.enter().append('g').attr("class", "node").merge(slice);
    slice.exit().remove();


    // Append <path> elements and draw lines based on the arc calculations. Last, color the lines and the slices.
    slice.selectAll('path').remove();
    newSlice.append('path').attr("display", function (d) { return d.depth ? null : "none"; })
        .attr("d", arc)
        .style('stroke', '#fff')
        .style("fill", function (d) { return color((d.children ? d : d.parent).data.name); });

    // Populate the <text> elements with our data-driven titles.
    slice.selectAll('text').remove();
    newSlice.append("text")
        .attr("transform", function(d) {
            return "translate(" + arc.centroid(d) + ")rotate(" + computeTextRotation(d) + ")"; })
        .attr("dx", function(d) { return (d.parent? "-20" : "-40")} )
        .attr("dy", function(d) { return (d.parent? ".5em" : "-2em")})
        .text(function(d) { return d.data.name });

    newSlice.on("click", highlightSelectedSlice);
}


d3.selectAll("input[name=topTopicsSelect]").on("click", showTopTopics);
d3.selectAll("input[name=dateSelect]").on("click", showDate);
d3.selectAll("input.corpus").on("click", getData);


// Redraw the Sunburst Based on User Input
function highlightSelectedSlice(c,i) {

    clicked = c;
    var rootPath = clicked.path(root).reverse();
    rootPath.shift(); // remove root node from the array

    newSlice.style("opacity", 0.4);
    newSlice.filter(function(d) {
        if (d === clicked && d.prevClicked) {
            d.prevClicked = false;
            newSlice.style("opacity", 1);
            return true;

        } else if (d === clicked) {
            d.prevClicked = true;
            return true;
        } else {
            d.prevClicked = false;
            return (rootPath.indexOf(d) >= 0);
        }
    }).style("opacity", 1);

}


function showDate() {
    alert("Not yet implemented: " + this.value);
}


function getData() {

    switch(this.value) {
        case "Corpus A":
            corpus = "corpusA.json";
            break;
        case "Corpus B":
            corpus = "corpusB.json";
            break;
        default:
            corpus = "corpusA.json";
    }

    // Get the data from our JSON file
    d3.json(corpus, function(error, nodeData) {
        if (error) throw error;

        allNodes = nodeData;
        var showNodes = JSON.parse(JSON.stringify(nodeData));

        drawSunburst(allNodes);
    });

}


// Redraw the Sunburst Based on User Input
function showTopTopics(r, i) {


    switch(this.value) {
        case "top5":
            root.sum(function (d) { d.topSize = (d.rank <= 3) ? d.size : 0; return d.topSize; });
            break;
        case "top10":
            root.sum(function (d) { d.topSize = (d.rank <= 6) ? d.size : 0; return d.topSize; });
            break;
        default:
            root.sum(function (d) { d.topSize = d.size; return d.topSize; });
    }

    partition(root);

    newSlice.selectAll("path").transition().duration(750).attrTween("d", arcTweenPath);
    newSlice.selectAll("text").transition().duration(750).attrTween("transform", arcTweenText)
        .attr("opacity", function (d) { return d.x1 - d.x0 > 0.01 ? 1 : 0; });
}


/**
 * When switching data: interpolate the arcs in data space.
 * @param {Node} a
 * @param {Number} i
 * @return {Number}
 */
function arcTweenPath(a, i) {

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
 * @param {Number} i
 * @return {Number}
 */
function arcTweenText(a, i) {

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
    return (angle < 120 || angle > 270) ? angle : angle + 180;  // labels as rims
    //return (angle < 180) ? angle - 90 : angle + 90;  // labels as spokes
}