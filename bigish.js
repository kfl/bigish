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
        var cost = random_int(0, 1000)*(1/(1+drg[4]));
        var bias = random_int(0,3);
        buf.push({cost: cost,
                  days: random_int(0, 10)+mdg[3],
                  m_cost: random_int(10, 10000)*(+mdg[4]),
                  noise: random_gauss(),
                  drg: drg,
                  mdg: mdg,
                  gender: bias < 3 ? 'm' : 'f'});
            
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

var data_cf, drg, drgG, mdg, mdgG, gender, genderG;
var selected = d3.map(), lastDim;
var filter = d3.dispatch("filter");

function populate_cf() {
    var start = new Date().getTime();
    var n = +document.getElementById('rows').value;
    var buf = generate_data(n);
    data = buf;

    data_cf = crossfilter(buf);
//    data_cf.add(buf);
    var count = data_cf.groupAll().reduceCount().value();


    var end = new Date().getTime();
    var time = (end - start)/1000;
    chatty('CF generated: '+time+'s, '+count+' rows');


    return false;
}


function setupDim() {
    drg = timea(data_cf.dimension,function(d){return d.drg;},'DRG Dimension: ');
    drgG = time(drg.group, 'DRG Grouping: ');

    mdg = timea(data_cf.dimension,function(d){return d.mdg;},'MDG Dimension: ');
    mdgG = time(mdg.group, 'MDG Grouping: ');

    gender = timea(data_cf.dimension,function(d){return d.gender;},'Gender Dimension: ');
    genderG = time(gender.group, 'Gender Grouping: ');
   
    return false;
}

function drawCosts() {
    drawCost('#drgs', drg, drgG);
    drawCost('#mdgs', mdg, mdgG);
    drawCost('#genders', gender, genderG);
    return false;
}


// Draw barchart with D3 based on data from Crossfilter
function drawCost(id, dim, group) {
    var counts = group.reduceSum(function(r){return r.cost;}).all();

    var width = 300,
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
        if ( selected.get(id) === d.key ) {
            rect.classed('selected', false);
            selected.remove(id);

            if (selected.empty()) {
                lastDim = dim;
                dim.filter('Kasper');  // Hack suggested by Professor Hornbæk, works surprisingly well.
                                       // Relies on Kasper being a unique individual not to be found in mere data.
            } else {
                time(dim.filterAll, 'Remove all filters on '+id+': ');
            }
            filter['filter'](id);
        } else {
            chart.select('.selected').classed('selected', false);
            rect.classed('selected', true);
            selected.set(id, d.key);
            console.log('Filter on: '+d.key);
            timea(dim.filter, d.key, 'Filter on '+d.key+': ');
            if( lastDim && lastDim !== dim) time(lastDim.filterAll, 'Remove all filters on lastDim: ');
            lastDim = undefined;

            filter['filter'](id, d.key);
        }
    });

    chart_svg.append("g")
        .classed('overlay', true);
    var overlay = chart_svg.select('.overlay');

    filter.on('filter.'+id.slice(1), function(cat, key){
        console.log('Got it: '+cat+' ('+id+') '+key);
        overlay.selectAll('g').remove();
        if ( !selected.has(id) && !selected.empty() ) {
            counts = group.all();
            drawBarChart(x, barHeight, overlay, counts);
        }
    });


    return false;
}


// Draw a barchart from a key-value mapping with D3
function drawBarChart(x, barHeight, chart, counts) {
    // counts.forEach(function (elem){
    //     console.log(elem.key+': '+elem.value);
    // });


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
        .text(function(d) { return d.value|0; });

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
var idxs, drgIdx, mdgIdx, genderIdx, data;
function makeIdxs(grps) {
    var idxs = grps.map(function(g){ return {grp: g, idx: d3.map()};});
    for(var i = 0; i < data.length; ++i){
        var dat = data[i];
        for(var j = 0; j < idxs.length; ++j){
            var gi = idxs[j];
            var g = gi.grp(dat);
            var inds = gi.idx.get(g) || [];
            inds.push(i);
            gi.idx.set(g, inds);
        }
    }
    return idxs;
}

function makeIndexes() {
    var n = +document.getElementById('rows').value;
    data = generate_data(n);
    idxs = timea(makeIdxs, [function(d){ return d.drg;}, 
                            function(d){ return d.mdg;},
                            function(d){ return d.gender;}], 
                 'Indexes: ');

    drgIdx = idxs[0], mdgIdx = idxs[1], genderIdx = idxs[2]; 

    return false;
}

function intersection_destructive(arrs){
    if(arrs.length === 0) return [];
    if(arrs.length === 1) return arrs[0];
    var arrays = _.invoke(arrs, 'slice', 0);      // make copies, so we can use destructive operations

    var res = [];
    function nonEmpty(a){ return a.length > 0; }
    while( _.every(arrays, nonEmpty) ) {
        var lasts = _.map(arrays, _.last);
        if(_.size(_.groupBy(lasts, _.identity)) === 1) {
            res.push(_.first(lasts));
            _.invoke(arrays, 'pop');
        } else {
            var min = _.min(lasts);
            _.each(arrays, function(arr) {
                while(nonEmpty(arr) && _.last(arr) > min) 
                    arr.pop();
            });
        }
    }

    return res;
}

function intersection(arrs){
    if(arrs.length === 0) return [];
    if(arrs.length === 1) return arrs[0];

    var arrays = _.map(arrs, function(a){ return {arr: a, last: a.length-1};});
    function nonEmpty(a){ return a.last >= 0; }
    function pop(a){ a.last--; }
    function last(a){ return a.arr[a.last]; }
    
    function allEqual(elems) { 
        var first = elems[0];
        for(var i = 1; i < elems.length; ++i)
            if ( elems[i] !== first ) return false;
        return true;
    }

    var res = [];

    while( _.every(arrays, nonEmpty) ) {
        var lasts = _.map(arrays, last);
        if (allEqual(lasts)) {
            res.push(_.first(lasts));
            arrays.forEach(pop);
        } else {
            var min = _.min(lasts);
            arrays.forEach(function(arr) {
                while(nonEmpty(arr) && last(arr) > min) 
                    pop(arr);
            });
        }
    }

    return res;
}


function drawCostsManual() {
    var costs = timea(computeCostsAll, idxs, 'Compute all costs: ');
    var viz = _.zip(['#drgs', '#mdgs', '#genders'], costs);
    //var viz = mapCosts([]);
    _.each(viz, function(v){ drawCostManual(v[0], v[1].idx, v[1].costs); });

    return false;
}

function mapCosts(selected) {
    var costs = timea(_.partial(computeCosts, idxs), selected, 'Compute costs: ');
    var viz = _.zip(['#drgs', '#mdgs', '#genders'], costs);
    return viz;
}

function computeCostsAll(idxs) {
    var costs = _.map(idxs, function(idx) {
        var gcosts = _.reduce(idx.idx.entries(), function(m, entry){
            var total = _.reduce(entry.value, 
                                 function(acc, i){
                                     var d = data[i];
                                     return acc + d.cost|0; },
                                 0|0);
            m.push({key: entry.key, value: total}); return m; }, []);
        return {grp: idx.grp, idx: idx.idx, costs: gcosts};});

    return costs;
}

function computeCosts(idxs, selected) {
    // var active = selected.length > 0 ? selected : [];
    // var costs = _.map(idxs, function(idx) {
    //     var gcosts = _.reduce(idx.idx.entries(), function(m, entry){
    //         active.push(entry.value);
    //         var total = _.reduce(intersection(active), 
    //                              function(acc, i){
    //                                  var d = data[i];
    //                                  return acc + d.cost|0; },
    //                              0|0);
    //         active.pop();
    //         m.push({key: entry.key, value: total}); 
    //         return m; }, []);
    //     return {grp: idx.grp, idx: idx.idx, costs: gcosts};});

    // return costs;
    var costs = _.map(idxs, function(idx) {
        var gcosts = _.reduce(idx.idx.keys(), function(m, key){ m.set(key, 0|0); return m; }, d3.map());
        return {grp: idx.grp, idx: idx.idx, costs: gcosts};});

    _.each(selected, function (i) {
        var elem = data[i];
        costs.forEach(function(dim) {
            var g = dim.grp(elem);
            dim.costs.set(g, dim.costs.get(g) + elem.cost);
        });
    });
    return _.map(costs, function(c){ return {grp: c.grp, idx: c.idx, costs: c.costs.entries()};});
}

var selectedI = d3.map();
var selectedCosts;

function addSelection(id, idx, key) {
    selectedI.set(id, idx.get(key));
    var selected = intersection(selectedI.values());
    selectedCosts = _.reduce(mapCosts(selected), 
                             function(m, e){ m.set(e[0], e[1].costs); return m;},
                             d3.map());
}

function removeSelection(id, key) {
    selectedI.remove(id);
    var selected = intersection(selectedI.values());
    selectedCosts = _.reduce(mapCosts(selected), 
                             function(m, e){ m.set(e[0], e[1].costs); return m;},
                             d3.map());
}




// Draw barchart with D3 based on a array of key-value counts 
function drawCostManual(id, idx, counts) {
//    var counts = group.reduceSum(function(r){return r.cost;}).all();

    var width = 300,
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
        if ( selected.get(id) === d.key ) {
            rect.classed('selected', false);
            selected.remove(id);
            removeSelection(id, d.key);
            filter['filter'](id);
        } else {
            chart.select('.selected').classed('selected', false);
            rect.classed('selected', true);
            selected.set(id, d.key);
            addSelection(id, idx, d.key);
            console.log('Filter on: '+d.key);
            filter['filter'](id, d.key);
        }
    });

    chart_svg.append("g")
        .classed('overlay', true);
    var overlay = chart_svg.select('.overlay');

    filter.on('filter.'+id.slice(1), function(cat, key){
        console.log('Got it: '+cat+' ('+id+') '+key);
        overlay.selectAll('g').remove();
        if ( !selected.has(id) && !selected.empty() ) {
            drawBarChart(x, barHeight, overlay, selectedCosts.get(id));
        }
    });


    return false;
}


