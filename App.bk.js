var packageType = 'iOS System';
var featureQuery = "( ((Release.Name = '0.8') or (Relaease.Name = '0.9')) or (Release.Name = '0.10') )";
/**********************************/

var app = null;
var storyCache = [];
var storyFeatureMap = [];
var featureCache = [];
Ext.define('TestCaseTraceability', {
    extend: 'Rally.app.App',
    componentCls: 'traceable',
    cls: 'traceable',


    launch: function () {
        console.log("Launching app");
        app = this;
        var queryParser = Ext.create('Rally.data.util.QueryStringParser', {
            string: featureQuery
        });

        var tcStore = Ext.create('Rally.data.wsapi.Store', {
            model: 'PortfolioItem/Feature',
            fetch: ['Name', 'FormattedID', 'UserStories', 'ObjectID'],
            filters: [
                {
                    property: "Release",
                    operator: "!= ",
                    value: null
                }
            ],
            autoLoad: false,
            limit: 'Infinity'
        });

        tcStore.load().then({
            success: app.loadAllData,
        }).then({
                success: function (traceRecords) {
                    console.log("Successfully got trace records: ", traceRecords);
                    app.processTraceRecords(traceRecords);
                },
                failure: function (error) {
                    console.log("error: ", error);
                }
            });
    },

    loadAllData: function (features) {
        console.log("Load features: ", features);
        var promises = [];
        _.each(features, function (feature) {                               // for each feature

            console.log("features: ", feature.get("FormattedID"));

            if (feature.getCollection('UserStories')) {

                console.log("UserStories: ", feature.getCollection("UserStories"));

                feature.getCollection("UserStories").load({                         // load user stories
                    fetch: ['TestCases'],
                    callback: function (userStories) {
                        _.each(userStories, function (userStory) {                  // for each user story
                            if (userStory.getCollection('TestCases')) {
                                userStory.getCollection('TestCases').load({         // load test cases
                                    fetch: ['Results', 'FormattedID', 'Name'],
                                    filters: [
                                        {                                           // with SRS TC tag
                                            property: "Tags.Name",
                                            operator: "=",
                                            value: "SRS TC"
                                        }
                                    ],
                                    callback: function (testCases) {
                                        console.log("TestCases: ", testCases);

                                        if (testCases.length == 0) {
                                            var traceRecord = {};
                                            var deferred = Ext.create('Deft.Deferred');
                                            traceRecord.featureID = feature.get("FormattedID");
                                            traceRecord.featureName = feature.get("Name");
                                            traceRecord.testCaseId = "--";
                                            traceRecord.testCaseName = "--";
                                            traceRecord.lastVerdict = "Not Tested";
                                            traceRecord.build = "--";
                                            traceRecord.notes = "--";
                                            deferred.resolve(traceRecord);
                                            promises.push(deferred.promise);
                                        }

                                        _.each(testCases, function (testCase) {     // for each test case
                                            var traceRecord = {};
                                            var deferred = Ext.create('Deft.Deferred');

                                            traceRecord.featureID = feature.get("FormattedID");
                                            traceRecord.featureName = feature.get("Name");
                                            traceRecord.testCaseId = testCase.get("FormattedID");
                                            traceRecord.testCaseName = testCase.get("Name");

                                            app.loadResultForTestCase(testCase).then({  // load results

                                                success: function (result) {
                                                    if (result) {
                                                        traceRecord.lastVerdict = result.get("Verdict");
                                                        traceRecord.build = result.get("Build");
                                                        traceRecord.notes = result.get("Notes");
                                                    } else {
                                                        traceRecord.lastVerdict = "Not Tested";
                                                        traceRecord.build = "--";
                                                        traceRecord.notes = "--";

                                                    }
                                                    console.log("test result: ", traceRecord);
                                                    deferred.resolve(traceRecord);
                                                },

                                                failure: function (error){
                                                    deferred.reject("Could not find result");
                                                }
                                            });
                                            promises.push(deferred.promise);

                                        });
                                    }
                                })

                            }

                        });
                    }
                });
            }
        })
        console.log("Returning Promises Now");
        return Deft.Promise.all(promises);
    },


    loadResultForTestCase: function (testCase) {
        var deferred = Ext.create('Deft.Deferred');
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
                    deferred.resolve(result);
                } else {
                    deferred.reject("Error loading results.");
                }
            }
        })
        return deferred.promise;
    },

    processTraceRecords: function (traceRecords) {

        var grid = app.down("rallygrid");
        if (grid) {
            grid.destroy();
        }

        console.log("traceRecords: ", flatRecords);

        app.add({
            xtype: 'rallygrid',
            showPagingToolbar: true,
            showRowActionsColumn: false,
            editable: false,
            store: Ext.create('Rally.data.custom.Store', {
                data: traceRecords
            })

//            features: [{
//                ftype: 'groupingsummary',
//				groupHeaderTpl: [
//				    '{name} ',
//				    '{rows:this.formatRows}',
//				    {
//				        formatRows: function(rows) {
//				        	var lastVerdictCount = _.countBy(rows, function(row){
//					        	return row.get("lastVerdict");
//				        	})
//				            return "(Pass: " + (lastVerdictCount.Pass ? lastVerdictCount.Pass : 0 )
//				            		+ ", Fail: " + (lastVerdictCount.Fail ? lastVerdictCount.Fail : 0 ) + ")";
//				        }
//				    }
//
//				]
//            }],
//
//            store: Ext.create('Rally.data.custom.Store', {
//                data: traceRecords,
//                groupField: 'featureID',
//                groupDir: 'ASC',
//                getGroupString: function(record) {
//                    var groupString = record.get('featureID');
//                    if (groupString) {
//                    	groupString = groupString + " " + record.get("featureName");
//                    } else {
//                    	groupString = "No feature found";
//                    }
//
//                    return groupString;
//                }
//			}),
//
//			columnCfgs: [
//                {text:'TestCase ID', dataIndex: "testCaseId", flex: 1},
//                {text:'TestCase Name', dataIndex: "testCaseName", flex: 1},
//                {text:'Result', dataIndex: "lastVerdict", flex: 1},
//                {text:'Build', dataIndex: "build", flex: 1},
//                {text:'Notes', dataIndex: "notes", flex: 1}
//            ],
//
//		    viewConfig: {
//		        stripeRows: false,
//		        getRowClass: function(record) {
//		        	return record.get("lastVerdict").replace(/\s+/g, '-').toLowerCase();
//		        }
//		    },
//
//            context: app.getContext()
        });
    }


});