var packageType = 'iOS System';
var featureQuery = "( ((Release.Name = '0.8') or (Relaease.Name = '0.9')) or (Release.Name = '0.10') )";
/**********************************/

var app = null;
var featureCache = [];
Ext.define('TestCaseTraceability', {
    extend: 'Rally.app.App',
    componentCls: 'traceable',
    cls: 'traceable',
    items:  [
                {xtype:'container',itemId:'export_box',margin: 10, layout: { type: 'hbox'} },
                {xtype:'container',itemId:'grid_box',padding:10}
            ],

    launch: function () {
        console.log("Launching app");
        app = this;

        app.down("#export_box").add({
            xtype: 'rallybutton',
            text: 'Export',
            padding: 5,
            margin: 5,
            handler: function() {
                app._exportGridData();
            }
        });

        var queryParser = Ext.create('Rally.data.util.QueryStringParser', {
            string: featureQuery
        });
        this._loadFeatures().then({
            success: this._loadStories,
            scope: this
        }).then({
                success: this._loadTestCases,
                scope: this
            }).then({
                success: this._loadTestCaseResults,
                scope: this
            }).then({
                success: function(results) {
                    app.drawGrid(app.flattenFeatureTree());
                }
            });
    },


    _exportGridData: function() {
        this._loadFeatures().then({
            success: this._loadStories,
            scope: this
        }).then({
                success: this._loadTestCases,
                scope: this
            }).then({
                success: this._loadTestCaseResults,
                scope: this
            }).then({
                success: function(results) {
                    app._exportCSV(app.flattenFeatureTree());
                }
            });
    },

    _exportCSV: function(traceRecords) {
        var csvArray = [];
        csvArray.push(_.keys(traceRecords[0]));
        _.each(traceRecords,function(record){
            csvArray.push(_.map(_.values(record), function(val){return '"' + val + '"'}));
        });

        var csvContent = "data:text/csv;charset=utf-8," + csvArray.join("\n");
        console.log("csvContent: ", csvContent);
        var encodedUri = encodeURI(csvContent);

        var aLink = document.createElement('a');
        var evt = document.createEvent("HTMLEvents");
        evt.initEvent("click");
        aLink.download = "traceability.csv";
        aLink.href = encodedUri;
        aLink.dispatchEvent(evt);
    },

    _loadFeatures: function() {
        var featureStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'PortfolioItem/Feature',
            fetch: ['Name', 'FormattedID', 'UserStories', 'ObjectID'],
            filters: [
                {
                    property: "Release",
                    operator: "!=",
                    value: null
                }
            ],
            autoLoad: false,
            limit: 'Infinity'
        });

        return featureStore.load();
    },

    _loadStories: function(features) {
        app.featureTree = features;
        var promises = [];
        _.each(features, function (feature) {
            console.log("Loading feature: ", feature.get("FormattedID"));
            var stories = feature.getCollection("UserStories");
            console.log("UserStories: ", stories);
            feature.storiesStore = stories;
            promises.push(stories.load({fetch: ['TestCases', 'FormattedID']}));
        });
        return Deft.Promise.all(promises);
    },

    _loadTestCases: function(stories) {
        var promises = []
        _.each(_.flatten(stories), function (story) {
            console.log("Loading story: ", story.get("FormattedID"));
            var testCases = story.getCollection("TestCases");
            console.log("Test Cases: ", testCases);
            story.testCasesStore = testCases;
            promises.push(testCases.load({
                fetch: ['Results', 'FormattedID', 'Name'],
                filters: [
                    {
                        property: "Tags.Name",
                        operator: "=",
                        value: "SRS TC"
                    }
                ]
            }));
        });
        return Deft.Promise.all(promises);
    },


    _loadTestCaseResults: function(testCases) {
        var promises = [];
        _.each(_.flatten(testCases), function(testCase) {
            promises.push(this.loadResultForTestCase(testCase));
        }, this);
        return Deft.Promise.all(promises);
    },


    loadResultForTestCase: function (testCase) {
        var deferred = Ext.create('Deft.Deferred');
        console.log("Loading testcase: ", testCase.get("FormattedID"));

        testCase.getCollection("Results").load({
            fetch: ['SystemPackage', 'Verdict', 'Build', 'Notes'],
            callback: function (results, operation, success) {
                var result = null;
                if (success) {
                    for (var index = results.length; index--; index >= 0) {
                        if (results[index].get("c_SystemPackage") === packageType) {
                            result = results[index];
                            break;
                        }
                    }
                    console.log("result: ", result);
                    testCase.resultStore = result;
                    deferred.resolve(result);
                } else {
                    deferred.reject("Error loading results.");
                }
            }
        });
        return deferred.promise;
    },

    flattenFeatureTree: function(results) {
        var traceRecords = [];
        console.log("FeatureTree: ", app.featureTree);
        _.each(app.featureTree, function (feature){
            var stories = feature.storiesStore.data.items;
            var allTests = [];
            _.each(stories, function(story) {
                var testCases = story.testCasesStore.data.items;
                if (testCases && testCases.length > 0)
                    allTests.push(testCases);
            });

            console.log("ALL Tests: ", _.flatten(allTests));

            allTests =  _.flatten(allTests);

            if (allTests.length == 0 ) {
                var traceRecord = {};
                traceRecord.featureID = feature.get("FormattedID");
                traceRecord.featureName = feature.get("Name");
                traceRecord.testCaseId = "--";
                traceRecord.testCaseName = "--";
                traceRecord.lastVerdict = "--";
                traceRecord.build = "--";
//                traceRecord.notes = "--";
                traceRecords.push(traceRecord);
            }



            _.each(allTests, function (testCase) {
                var traceRecord = {};
                traceRecord.featureID = feature.get("FormattedID");
                traceRecord.featureName = feature.get("Name");
                traceRecord.testCaseId = testCase.get("FormattedID");
                traceRecord.testCaseName = testCase.get("Name");
                if (testCase.resultStore) {
                    console.log("Result Store: ", testCase.resultStore);
                    traceRecord.lastVerdict = testCase.resultStore.get("Verdict");
                    traceRecord.build = testCase.resultStore.get("Build");
//                    traceRecord.notes = testCase.resultStore.get("Notes");

                } else {
                    traceRecord.lastVerdict = "Not tested";
                    traceRecord.build = "--";
//                    traceRecord.notes = "--";
                }
                traceRecords.push(traceRecord);
            });

        });
        console.log("trace records: ", traceRecords);
        return traceRecords;
    },

    drawGrid: function (traceRecords) {

        var grid = app.down("#grid_box").down("rallygrid");
        if (grid) {
            grid.destroy();
        }

        console.log("traceRecords: ", traceRecords);

        app.down("#grid_box").add({
            xtype: 'rallygrid',
            showPagingToolbar: true,
            showRowActionsColumn: false,
            editable: false,
			columnCfgs: [
               {text:'TestCase ID', dataIndex: "testCaseId", flex: 1},
               {text:'TestCase Name', dataIndex: "testCaseName", flex: 1},
               {text:'Result', dataIndex: "lastVerdict", flex: 1},
               {text:'Build', dataIndex: "build", flex: 1},
//               {text:'Notes', dataIndex: "notes", flex: 1}
           ],

            features: [{
                ftype: 'groupingsummary',
				groupHeaderTpl: [
				    '{name} ',
				    '{rows:this.formatRows}',
				    {
				        formatRows: function(rows) {
				        	var lastVerdictCount = _.countBy(rows, function(row){
					        	return row.get("lastVerdict");
				        	})
				            return "(Pass: " + (lastVerdictCount.Pass ? lastVerdictCount.Pass : 0 )
				            		+ ", Fail: " + (lastVerdictCount.Fail ? lastVerdictCount.Fail : 0 ) + ")";
				        }
				    }

				]
            }],

            store: Ext.create('Rally.data.custom.Store', {
                data: traceRecords,
                groupField: 'featureID',
                groupDir: 'ASC',
                getGroupString: function(record) {
                    var groupString = record.get('featureID');
                    if (groupString) {
                    	groupString = groupString + " " + record.get("featureName");
                    } else {
                    	groupString = "No feature found";
                    }

                    return groupString;
                }
			}),

		    viewConfig: {
		        stripeRows: false,
		        getRowClass: function(record) {
		        	return record.get("lastVerdict").replace(/\s+/g, '-').toLowerCase();
		        }
		    },

            context: app.getContext()
        });
    }

});