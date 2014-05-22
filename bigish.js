"use strict";

function doit() {
    var sum = 0|0;
    var n = 13000000|0;
    var out = document.getElementById('output');
    var min = 1|0, max = 1000|0;

    var start = new Date().getTime();
    var data = new Int32Array(n);

    while(n > 0) {
        for(var i=0; i < 1000; ++i, --n) {
            data[n] = (Math.floor(Math.random() * (max - min + 1)) + min)|0;
        }
    }
    var end = new Date().getTime();
    var time = (end - start)/1000;
    out.innerHTML = 'Array Time: '+time+'\n\n'+out.innerHTML;
    return false;
}


/*************************************************************************************
 * Utility functions
 * 
 * chatty is for logging
 * time{,a} is for timing functions
 *************************************************************************************/


function chatty(msg) {
    var out = document.getElementById('output');
    out.innerHTML += msg + '\n';
}

function time(fn, lab) {
    var start = new Date().getTime();
    var res = fn();
    var end = new Date().getTime();
    var time = (end - start)/1000;
    chatty(lab+time+'s');
    return res;
}

function timea(fn, args, lab) {
    var start = new Date().getTime();
    var res = fn(args);
    var end = new Date().getTime();
    var time = (end - start)/1000;
    chatty(lab+time+'s');
    return res;
}


/*************************************************************************************
 * Utility functions for generating random data
 * 
 *************************************************************************************/

function random_range(min, max) {
    return Math.random()*(max - min) + min;
}


function random_int(min, max) {
    return Math.floor(Math.random()*(max - min + 1)) + min;
}

function random_elem(elems) {
    return function() {
        return elems[random_int(0, elems.length - 1)];
    };
}

function random_string(len) {
    var buf = [];
    for(var i = 0; i < Math.ceil(len/2); ++i) {
        buf.push(String.fromCharCode(random_int(65,90)));
    }
    for(i = 0; i < Math.floor(len/2); ++i) {
        buf.push(String.fromCharCode(random_int(48,57)));
    }

    return buf.join('');
}

function random_array(len, gen) {
    var buf = [];
    for(var i = 0; i < len; ++i) {
        buf.push(gen());
    }
    return buf;
}

function random_gauss() {
    var u1 = Math.random();
    var u2 = Math.random();
    return Math.sqrt(-2*Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}


// Generate an array of n records

function generate_data(n_arg) {
    var sum = 0|0;
    var n = n_arg || 13000000|0;
    chatty('Starting Generation of data');

    var start = new Date().getTime();
    var buf = [];

    var drgs = random_elem(random_array(30, function(){ return random_string(5); }));
    var mdgs = random_elem(random_array(30, function(){ return random_string(5); }));


    for(var i=0; i < n; ++i) {
        var drg = drgs(), mdg = mdgs();
        buf.push({cost: random_int(0, 1000)*drg[4],
                  days: random_int(0, 10)+mdg[3],
                  m_cost: random_int(10, 10000)*mdg[4],
                  noise: random_gauss(),
                  drg: drgs(),
                  mdg: mdgs(),
                  gender: random_int(0,1)});
            
    }
    var end = new Date().getTime();
    var time = (end - start)/1000;
    chatty('Data generated: '+time+'s');
    return buf;
}


/*************************************************************************************
 * CrossFilter related code
 * 
 * 
 *************************************************************************************/

var data_cf, drg, drgG, mdg, mdgG;
var highlight = d3.dispatch("drgCost", "mdgCost");

function populate_cf() {
    var start = new Date().getTime();
    var n = +document.getElementById('rows').value;
    var buf = generate_data(n);

    data_cf = crossfilter([]);
    data_cf.add(buf);
    var count = data_cf.groupAll().reduceCount().value();


    var end = new Date().getTime();
    var time = (end - start)/1000;
    chatty('CF generated: '+time+'s, '+count+' rows');


    return false;
}


function setupDim() {
    drg = timea(data_cf.dimension,function(d){return d.drg;},'DRG Dimension: ');
    drgG = time(drg.group().reduceCount, 'DRG Group & Reduce: ');

    mdg = timea(data_cf.dimension,function(d){return d.mdg;},'MDG Dimension: ');
    mdgG = time(mdg.group, 'MDG Group & Reduce: ');
    
    return false;
}

function drawCosts() {
    drawCost('#drgs', drg, drgG, "drgCost", "mdgCost");
    drawCost('#mdgs', mdg, mdgG, "mdgCost", "drgCost");
    return false;
}


// Draw barchart with D3 based on data from Crossfilter
function drawCost(id, dim, group, hlPub, hlObs) {
    var counts = group.reduceSum(function(r){return r.cost;}).all();

    var width = 400,
        barHeight = 20;

    var val = function(d){return d.value;};

    var x = d3.scale.linear()
            .domain([0, d3.max(counts, val)])
            .range([0, width]);

    var chart_svg = d3.select(id)
            .attr("width", width)
            .attr("height", barHeight * counts.length);

    chart_svg.append("g")
        .classed('base', true);
    var chart = chart_svg.select('.base');

    var baseBars = drawBarChart(x, barHeight, chart, counts);
    baseBars.on("click", function(d) { 
        var rect = d3.select(this).select('rect');
        if ( rect.classed('selected') ) {
            rect.classed('selected', false);
            dim.filter('Kasper');  // Hack suggested by Professor Hornbæk, works surprisingly well.
                                   // Relies on Kasper being a unique individual not to be found in mere data.
            highlight[hlPub]();
        } else {
            chart.select('.selected').classed('selected', false);
            rect.classed('selected', true);
            console.log('Filter on: '+d.key);
            timea(dim.filter, d.key, 'Filter on '+d.key+': ');
            highlight[hlPub](d.key);
        }
    });

    chart_svg.append("g")
        .classed('overlay', true);
    var overlay = chart_svg.select('.overlay');

    highlight.on(hlObs, function(key){
        overlay.selectAll('g').remove();
        if ( key ) drawBarChart(x, barHeight, overlay, counts);
    });


    return false;
}


// Draw a barchart from a key-value mapping with D3
function drawBarChart(x, barHeight, chart, counts) {
    var bar = chart.selectAll("g")
            .data(counts)
            .enter().append("g")
            .attr("transform", function(d, i) { return "translate(0," + i * barHeight + ")"; });

    bar.append("rect")
        .attr({width: function(d) { return x(d.value); },
               height: barHeight - 1});

    bar.append("text")
        .attr({x: function(d) { return x(d.value) - 3; },
               y: barHeight / 2,
               dy: ".35em"})
        .text(function(d) { return d.value; });

    bar.append("text")
        .classed("lab", true)
        .attr({x: 2,
               y: barHeight / 2,
               dy: ".35em"})
        .text(function(d) { return d.key; });

    return bar;
}


/*************************************************************************************
 * Manual creation of index, alternative to CrossFilter
 *************************************************************************************/
var drgIdx, mdgIdx, data;
function makeIdxs(grps) {
    var idxs = grps.map(function(g){ return {grp: g, idx: d3.map()};});
    for(var i = 0; i < data.length; ++i){
        var dat = data[i];
        for(var j = 0; j < idxs.length; ++j){
            var gi = idxs[j];
            var g = gi.grp(dat);
            var arr = gi.idx.get(g) || [];
            arr.push(i);
            gi.idx.set(g, arr);
        }
    }
    return idxs;
}

function makeIndexes() {
    var n = +document.getElementById('rows').value;
    data = generate_data(n);
    var idxs = timea(makeIdxs, [function(d){ return d.drg;}, function(d){ return d.mdg;}], 
                     'Indexes: ');

    drgIdx = idxs[0], mdgIdx = idxs[1]; 

    return false;
}


