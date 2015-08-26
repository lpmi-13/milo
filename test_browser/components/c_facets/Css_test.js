'use strict';

var assert = require('assert')
    , async = require('async');

describe('Css facet', function() {
    var ComponentClass = milo.createComponentClass({
        className: 'CssComponent',
        facets: {
            css: {
                classes: {
                    // Used for simple tests
                    '.modelPath1': 'css-class-1',

                    // Used for object value lookup tests
                    '.modelPath2': {
                        'black': 'black-css-class',
                        'red': 'red-css-class',
                        'orange': '$-css-class'
                    },

                    // Used for function tests
                    '.modelPath3': function(data) {
                        return data ? data + '-class' : null;
                    },

                    // Used for template tests
                    '.modelPath4': '$-class'
                }
            }
        }
    });

    var component;
    var dataSource;

    beforeEach(function() {
        component = ComponentClass.createOnElement(null, '<div ml-bind="CssComponent:test"></div>');
        dataSource = new milo.Model();

        milo.minder(dataSource, '->>', component.css);
    });

    it('should apply css classes based on truthy values', function(done) {
        runTests.call(this, done, [
            test('.modelPath1', true, ['css-class-1']), // Add class
            test('.modelPath1', false, []), // Remove class
            test('.modelPath1', {}, ['css-class-1']), // Add class (truthy value, not boolean true)
            test('.modelPath1', '', []) // Remove class (falsey value, not boolean false)
        ]);
    });

    it('should apply classes based on model values in a lookup table', function(done) {
        runTests.call(this, done, [
            test('.modelPath2', 'black', ['black-css-class']), // Add
            test('.modelPath2', 'red', ['red-css-class']), // Replace
            test('.modelPath2', 'orange', ['orange-css-class']), // Replace (and is templated)
            test('.modelPath2', null, []), // Remove
            test('.modelPath2', 'green', []) // Not in lookup
        ]);
    });

    it('should apply classes based on the result of function calls', function(done) {
        runTests.call(this, done, [
            test('.modelPath3', 'apple', ['apple-class']), // Add
            test('.modelPath3', 'banana', ['banana-class']), // Replace
            test('.modelPath3', null, []), // Remove
        ]);
    });

    it('should template class names', function(done) {
        runTests.call(this, done, [
            test('.modelPath4', 'dog', ['dog-class']), // Add
            test('.modelPath4', 'cat', ['cat-class']), // Replace
            test('.modelPath4', null, [])
        ]);
    });

    it('should only remove classes when no other model value is applying the same class', function(done) {
        runTests.call(this, done, [
            test('.modelPath2', 'black', ['black-css-class']), // Add
            test('.modelPath3', 'black-css', ['black-css-class']), // Add same class (different model path)
            test('.modelPath4', 'black-css', ['black-css-class']), // Add same class (different model path
            test('.modelPath3', null, ['black-css-class']), // Null model value (class still applied due to other model values)
            test('.modelPath4', null, ['black-css-class']), // Null model value (class still applied due to other model values)
            test('.modelPath2', null, []) // Finally removed as no other model values result in the class being applied
        ]);
    });

    it('should allow model data to be set directly', function(done) {
        // Set directly
        component.css.set({
            '.modelPath1': true,
            '.modelPath2': 'red',
            '.modelPath3': 'pear',
            '.modelPath4': 'pig'
        });

        assertCssExists('css-class-1'); // modelPath1
        assertCssExists('red-css-class'); // modelPath2
        assertCssExists('pear-class'); // modelPath3
        assertCssExists('pig-class'); // modelPath4

        // Set via milo.binder connection
        dataSource.set({
            modelPath1: true,
            modelPath2: 'black',
            modelPath3: 'lemon',
            modelPath4: 'bear'
        });

        component.css.onSync('changedata', function() {
            assertCssExists('css-class-1'); // modelPath1
            assertCssExists('black-css-class'); // modelPath2
            assertCssExists('lemon-class'); // modelPath3
            assertCssExists('bear-class'); // modelPath4

            done();
        });

        function assertCssExists(className) {
            assert(component.el.classList.contains(className), 'Expected ' + className + ' css class to exist');
        }
    });

    function runTests(next, testSpecs) {
        this.timeout(100000);

        async.forEachSeries(testSpecs, runTest, next);

        function runTest(testSpec, next) {
            // Listen for the CSS facet to let us know it has updated the css classes
            component.css.onceSync('changed', onCssClassesChanged);

            // Update the model as per the test spec
            dataSource(testSpec.modelPath).set(testSpec.modelValue);

            function onCssClassesChanged(msg, data) {
                try {
                    assert.equal(testSpec.modelPath, data.modelPath);
                    assert.equal(testSpec.modelValue, data.modelValue);

                    var classList = component.el.classList;
                    var expectedClassList = testSpec.expectedCssClasses;

                    assert.equal(classList.length, expectedClassList.length,
                        'Class list mismatch.  Expected "' + expectedClassList.join(' ') + '" but got "' + classList.toString() + '"');

                    expectedClassList.forEach(function(cssClass) {
                        assert(classList.contains(cssClass),
                            'Missing expected class: ' + cssClass + '. ClassList was "' + classList.toString() + '"');
                    });

                    next();
                } catch(e) {
                    next(e);
                }
            }
        }
    }

    function test(modelPath, modelValue, expectedCssClasses) {
        return {
            modelPath: modelPath,
            modelValue: modelValue,
            expectedCssClasses: expectedCssClasses
        };
    }
});