var app = null;
var traceRecords = [];
var stories = [];
var storyFeatureMap = [];
var featureOidNameMap = []
var packageType = 'iOS';
Ext.define('TestCaseTraceability', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    launch: function() {
    	app = this;
 		var tcStore = Ext.create('Rally.data.wsapi.Store', {
			model: 'TestCase',
			fetch: ['Name', 'WorkProduct.Parent', 'Tags.Name', 'WorkProduct', 'LastVerdict', 'Results', 'FormattedID'],
			filters: [{
				property: "Tags.Name",
				operator: "=",
				value: "SRS TC"
			}],
			autoLoad: false,
			limit: 'Infinity' 
		});
		tcStore.load().then({
			success: function(testCases){
				app.loadTestCases(testCases)
			}	 
		}).then({
			success: app.processTraceRecords
		});
    },

    loadTestCases: function(testCases) {
    	var promises = [];
		_.each(testCases, function(testCase){
			if (testCase.data.WorkProduct && testCase.data.WorkProduct._type == "HierarchicalRequirement"){
				var traceRecord = {testCaseId: testCase.data.FormattedID, testCaseName: testCase.data.Name, lastVerdict: null, feature: null};
				promises.push(app.loadFeatureForTestCase(testCase, traceRecord));
				promises.push(app.loadResultForTestCase(testCase, traceRecord));
				traceRecords.push(traceRecord);				
			}			
		});
		return promises;
    },

    loadFeatureForTestCase: function(testCase, traceRecord) {
    	var deferred = Ext.create('Deft.Deferred');
    	var storyID = testCase.data.WorkProduct.FormattedID;
    	    	
    	if (_.contains(stories, storyID)) {
    		var featureDetail = featureOidNameMap[storyFeatureMap[storyID]];;
    	}

    	console.log("USer Story: ", storyID);

    	stories.push(storyID);

    	var storyStore = Ext.create('Rally.data.wsapi.Store', {
    		model: "UserStory",
    		fetch: ['Feature', 'Feature.FormattedID', 'Feature[FormattedID]'],
    		filters: [{
    			property: "FormattedID",
    			operator: "=",
    			value: testCase.data.WorkProduct.FormattedID
    		}],
    		autoLoad: false,
    	});
    	storyStore.load({
    		callback: function(stories, operation, success){
    			if (success) {
	    			var feature = stories[0].data.Feature;
	    			if (feature) {
	    				var featureOID = feature._ref.split("/")[3];
	    				console.log("oid: " , featureOID);
	    				storyFeatureMap.push({storyID:featureOID});
	    				app.getFeatureDetails(traceRecord, featureOID);
		    			traceRecord.feature = feature;    				
	    			} else {
		    			traceRecord.feature = "No Feature Found";    					    				
	    			}
	    			deferred.resolve(stories);    				    				
    			} else {
			        deferred.reject("Error loading stories.");
    			}
    		}

    	});
    	return deferred.promise;
    },


    getFeatureDetails: function(traceRecord, featureOID) {
    	if (_.contains(_.keys(featureOidNameMap), featureOID)) {
    		console.log("featureDetails: ", featureOidNameMap[featureOID]);
    		traceRecord.featureName = featureOidNameMap[featureOID].name;
    		traceRecord.featureID = featureOidNameMap[featureOID].formattedID;
    		return;
    	}
		var deferred = Ext.create('Deft.Deferred');
	   	var featureStore = Ext.create('Rally.data.wsapi.Store', {
	    		model: "PortfolioItem/Feature",
	    		fetch: ['FormattedID','Name'],
	    		filters: [{
	    			property: "ObjectID",
	    			operator: "=",
	    			value: featureOID
	    		}],
	    		autoLoad: true
	    	});
	    featureStore.load({
	    	callback: function(features, operation, success) {
	    		if (success) {
	    			if(features[0]){
	    				var formattedID = features[0].get("FormattedID");
	    				var name = features[0].get("Name")
		    			traceRecord.featureID = formattedID;
		    			traceRecord.featureName = name;
		    			featureOidNameMap.push({featureOID:{"formattedID": formattedID, "name": name}});
		    			deferred.resolve(features);
	    			}
	    		} else {
			        deferred.reject("Error loading feature");
	    		}

	    	}
	    });
	    return deferred.promise;

    },


    loadResultForTestCase: function(testCase, traceRecord) {
    	var deferred = Ext.create('Deft.Deferred');
    	testCase.getCollection("Results").load({
    		callback: function(results, operation, success) {
    			if(success) {
	    			for(var index = results.length; index--; index >=0 ){
	    				if(results[index].data.SystemPackage = packageType) {
	    					traceRecord.lastVerdict = results[index].data.Verdict;
	    					break;
	    				}
	    			}
	    			if (traceRecord.lastVerdict == null) {
	    				traceRecord.lastVerdict = "--"
	    			}
	    			deferred.resolve(results);
    			} else {
			        deferred.reject("Error loading results.");
    			}
    		}
    	})
    	return deferred.promise;
    },

    processTraceRecords: function() {

    	var grid = app.down("rallygrid");
    	if (grid) {
    		grid.destroy();
    	}

    	console.log("traceRecords: ", traceRecords);

		app.add({
			xtype: 'rallygrid',
            showPagingToolbar: true,
            showRowActionsColumn: false,
            editable: false,
            store: Ext.create('Rally.data.custom.Store', {
				data: traceRecords
            }),
			columnCfgs: [
                {text:'Feature ID', dataIndex: "featureID", flex: 1},
                {text:'Feature Name', dataIndex: "featureName", flex: 1},
                {text:'TestCase ID', dataIndex: "testCaseId", flex: 1},
                {text:'TestCase Name', dataIndex: "testCaseName", flex: 1},
                {text:'Result', dataIndex: "lastVerdict", flex: 1},
            ],
            context: app.getContext(),
            // features: [{
            //     ftype: 'groupingsummary',
            //     groupHeaderTpl: '{name} ({rows.length})'
            // }],
            // storeConfig: {
            //     model: 'task',
            //     groupField: 'Owner',
            //     groupDir: 'ASC',
            //     fetch: ['Owner'],
            //     getGroupString: function(record) {
            //         var owner = record.get('Owner');
            //         return (owner && owner._refObjectName) || 'No Owner';
            //     }
            // }
		});
	}

 });
