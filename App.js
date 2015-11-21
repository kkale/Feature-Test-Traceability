var app = null;
var traceRecords = [];
var packageType = 'iOS';
Ext.define('TestCaseTraceability', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    launch: function() {
    	app = this;
		console.log("Launching app");
 		var tcStore = Ext.create('Rally.data.wsapi.Store', {
			model: 'TestCase',
			fetch: ['Name', 'WorkProduct.Parent', 'Tags.Name', 'WorkProduct', 'LastVerdict', 'Results', 'FormattedID', 'Verdict', 'Date'],
			filters: [{
				property: "Tags.Name",
				operator: "=",
				value: "TESTCASES_REVIEWED"
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
				var traceRecord = {testCase: testCase.data.FormattedID, 
									lastVerdict: null, 
									feature: null};
				promises.push(app.loadFeatureForTestCase(testCase, traceRecord));
				promises.push(app.loadResultForTestCase(testCase, traceRecord));
				promises.push(traceRecords.push(traceRecord));				
			}			
		});
		return promises;
    },

    loadFeatureForTestCase: function(testCase, traceRecord) {
    	var deferred = Ext.create('Deft.Deferred');
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
	    			if (stories[0].data.Feature) {
		    			traceRecord.feature = stories[0].data.Feature;    				
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


    loadResultForTestCase: function(testCase, traceRecord) {
    	var deferred = Ext.create('Deft.Deferred');
    	testCase.getCollection("Results").load({
    		callback: function(results, operation, success) {
    			if(success) {
	    			console.log("testCase: ", testCase.data.FormattedID, ", Result Size: ", results.length);
	    			for(var index = results.length; index--; index >=0 ){
	    				if(results[index].data.SystemPackage = packageType) {
	    					console.log("lastVerdict: ", results[index].data.Verdict);
	    					traceRecord.lastVerdict = results[index].data.Verdict;
	    				}
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
    	console.log("traceRecords: ", traceRecords);
    }

 });
