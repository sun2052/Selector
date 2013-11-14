/**
 * Cross-Browser JavaScript Library for Querying DOM Elements
 * 
 * Specifications:
 * http://www.w3.org/TR/css3-selectors/
 * http://www.w3.org/TR/selectors-api2/
 * 
 * sun2052@gmail.com
 */
(function (window) {
	/**
	 * Invokes strict mode
	 * https://developer.mozilla.org/en/docs/JavaScript/Reference/Functions_and_function_scope/Strict_mode
	 */
	"use strict";
	var document = window.document;
	/**
	 * Runs the given function on every item in the array or array-like object.
	 * Pointer "this" in the callback function refers to the current element.
	 * Returns false will end the loop, the same as "break"; returns others will go to the next loop, like "continue".
	 *
	 * @param  {Array}  collection
	 * @param  {Function}  callback(element, index, collection){...}
	 * @param  {Boolean}  reverse
	 */
	function each(collection, callback, reverse) {
		var index = 0, length = collection.length, element;
		if (length > 0) {
			if (reverse) {
				for (index = length - 1; index >= 0; index--) {
					element = collection[index];
					if (callback.call(element, element, index, collection) === false) {
						break;
					}
				}
			} else {
				for (; index < length; index++) {
					element = collection[index];
					if (callback.call(element, element, index, collection) === false) {
						break;
					}
				}
			}
		}
	}
	/**
	 * Converts an array-like object to an array.
	 * 
	 * @param {Object|NodeList} collection
	 * @return {Array}
	 */
	function convertToArray(collection) {
		var array = null;
		try {
			array = Array.prototype.slice.call(collection, 0); // non-IE and IE9+
		} catch (e) {
			array = [];
			each(collection, function(element) {
				array.push(element);
			});
		}
		return array;
	}
	/**
	 * Parses the specified comma-separated selector.
	 * 
	 * @param {String} selector
	 * @returns {Array}
	 */
	function parseSelector(selector) {
		var strings = [], selectors = [], parsedSelectors = [];

		// Saves all the quoted strings and removes all the backslashes in all escaped characters.
		// Eliminates the need of dealing with special characters which may possibly appear in the quoted strings.
		selectors = selector.replace(/'[^'\\]*(?:\\.[^'\\]*)*'|"[^"\\]*(?:\\.[^"\\]*)*"/g, function(match, offset, string) {
			strings.push(match.replace(/\\(.)/g, "$1"));
			return "\0";  // Replaces the quoted string with a character '\0' as a mark of position.
		}).replace(/\s*([\s>+~(),]|^|$)\s*/g, "$1")  // Trims all the redundant whitespaces. (e.g. " body > div ~ p a " --> "body>div~p a")
		.replace(/([\s>+~,]|[^(]\+|^)([\[#.:])/g, "$1*$2")  // Adds implied universal selector "*". (e.g. ".class" --> "*.class")
		.split(",");  // Splits the selector group into an array of selectors.

		each(selectors, function (selector) {
			var parsedSelector = {
					combinators: selector.match(/[ >+~](?![=\d])/g) || [],  // [ >+~] except ~= and an+b
					compoundSelectors: []
				};
			
			each(selector.split(/[ >+~](?![=\d])/), function (compoundSelector) {
				parsedSelector.compoundSelectors.push(parseCompoundSelector(compoundSelector, strings));
			});
			
			parsedSelectors.push(parsedSelector);
		});
		
		return parsedSelectors;
	}
	/**
	 * Parses the specified compound selector.
	 * 
	 * @param {String} compoundSelector
	 * @param {Array} strings
	 * @return {Object}
	 */
	function parseCompoundSelector(compoundSelector, strings) {
		var simpleSelectors = compoundSelector.replace(/([\[:.#])/g, "\n$1").split("\n"),
			typeSelector = simpleSelectors.shift(),
			idSelector = "",
			attributeSelectors = [],
			pseudoSelectors = [];
		
		each(simpleSelectors, function(simpleSelector) {
			var attribute, pseudo;

			// Replaces all the placeholder character "\0" with the original quoted string.
			if (simpleSelector.indexOf("\0") !== -1) {
				simpleSelector = simpleSelector.replace("\0", strings.pop());
			}

			switch (simpleSelector.charAt(0)) {
				case "[":  // attribute selector
					attribute = simpleSelector.match(/^\[(-?[a-zA-Z_][\w-]*)(?:([~^$*|]?=)['"](.*)['"])?\]$/);
					attributeSelectors.push({
						attribute: attribute[1], // attribute[0] is the simple selector
						operator: attribute[2] || "",
						value: attribute[3]
					});
					break;
				case ":":  // pseudo selector
					pseudo = simpleSelector.match(/^:([\w_-]+)(?:\(((?:\d*n(?:[+-]\d+)?)|(?:[a-zA-Z]+))\))?$/);
					pseudoSelectors.push({
						name: pseudo[1], // pseudo[0] is the full simple selector
						parameter: pseudo[2]
					});
					break;
				case ".":  // class selector
					attributeSelectors.push({
						attribute: "className",
						operator: "~=",
						value: simpleSelector.substring(1)
					});
					break;
				case "#":  // id selector, only one
					idSelector = simpleSelector.substring(1);
					break;
			}
		});
		
		return {
			typeSelector: typeSelector,
			idSelector: idSelector,
			attributeSelectors: attributeSelectors,
			pseudoSelectors: pseudoSelectors
		};
	}
	/**
	 * Collection of utility functions used for attribute selector matching.
	 */
	var isMatchedByAttributeSelector = {
		"": function(element, attribute) {
			return element[attribute] !== null;
		},
		"=": function(element, attribute, value) {
			return element[attribute] === value;
		},
		"~=": function(element, attribute, value) {
			return (" " + element[attribute] + " ").indexOf(" " + value + " ") !== -1;
		},
		"^=": function(element, attribute, value) {
			var attributeValue = element[attribute];
			return attributeValue !== null && attributeValue.indexOf(value) === 0;
		},
		"$=": function(element, attribute, value) {
			var attributeValue = element[attribute];
			return attributeValue !== null && attributeValue.substring(attributeValue.length - value.length) === value;
		},
		"*=": function(element, attribute, value) {
			var attributeValue = element[attribute];
			return attributeValue !== null && attributeValue.indexOf(value) !== -1;
		},
		"|=": function(element, attribute, value) {
			var attributeValue = element[attribute];
			return attributeValue !== null && (attributeValue === value || attributeValue.indexOf(value + "-") === 0);
		}
	};
	/**
	 * Determine whether a specified element is n-th child of its parent node.
	 * 
	 * @param {Element} element
	 * @param {String} parameter
	 * @param {Boolean} reverse
	 * @param {String} tagName
	 */
	function isNthChild(element, parameter, reverse, tagName) {
		var parameters, a, b,
			counter = 1,  // Marks the position of the current element in the element child node of the parent node, counting from 1.
			current = element;
		
		if (parameter === "odd") {
			parameter = "2n+1";
		} else if (parameter === "even") {
			parameter = "2n";
		} else if (parameter === "n") {
			return true;
		}
		
		parameters = parameter.split("n");
		a = parameters[0] ? parseInt(parameters[0]) : 0;
		b = parameters[1] ? parseInt(parameters[1]) : 0;
		
		if (reverse) {
			if (tagName) {
				while (current.nextSibling !== null) {
					current = current.nextSibling;
					if (current.nodeType === 1 && (tagName === "*" || tagName.toLowerCase() === current.nodeName.toLowerCase())) {
						counter++;
					}
				}
			} else {
				while (current.nextSibling !== null) {
					current = current.nextSibling;
					if (current.nodeType === 1) {
						counter++;
					}
				}
			}
		} else {
			if (tagName) {
				while (current.previousSibling !== null) {
					current = current.previousSibling;
					if (current.nodeType === 1 && (tagName === "*" || tagName.toLowerCase() === current.nodeName.toLowerCase())) {
						counter++;
					}
				}
			} else {
				while (current.previousSibling !== null) {
					current = current.previousSibling;
					if (current.nodeType === 1) {
						counter++;
					}
				}
			}
		}
		if ((counter < a && counter === b) || ((counter - b) % a === 0)) {
			return true;
		} else {
			return false;
		}
	}
	/**
	 * Collection of utility functions used for pseudo selector matching.
	 */
	var isMatchedByPseudoSelector = {
		"root": function(element) {
			return element.nodeName.toLowerCase() === "html";
		},
		"nth-child": function(element, parameter) {
			return isNthChild(element, parameter);
		},
		"nth-last-child": function(element, parameter) {
			return isNthChild(element, parameter, true);
		},
		"nth-of-type": function(element, parameter) {
			return isNthChild(element, parameter, false, tagName);
		},
		"nth-last-of-type": function(element, parameter) {
			return isNthChild(element, parameter, true, tagName);
		},
		"first-child": function(element) {
			var firstChild = null;
			each(element.parentNode.childNodes, function(node) {
				if (node.nodeType === 1) {
					firstChild = node;
					return false;
				}
			});
			return element === firstChild;
		},
		"last-child": function(element) {
			var lastChild = null;
			each(element.parentNode.childNodes, function(node) {
				if (node.nodeType === 1) {
					lastChild = node;
					return false;
				}
			}, true);
			return element === lastChild;
		},
		"only-child": function(element) {
			var children = [];
			each(element.parentNode.childNodes, function(node) {
				if (node.nodeType === 1 && children.length <= 2) {
					children.push(node);
					return false;
				}
			});
			return children.length === 1 && element === children[0];
		},
		"only-of-type": function(element, tagName) {
			var children = [];
			each(element.parentNode.childNodes, function(node) {
				if (node.nodeType === 1 && children.length <= 2 && (tagName === "*" || tagName.toLowerCase() === current.nodeName.toLowerCase())) {
					children.push(node);
					return false;
				}
			});
			return children.length === 1 && element === children[0];
		},
		"empty": function(element) {
			return element.firstChild === null;
		},
		"link": function(element) {
			return element.nodeName.toLowerCase() === "a" && element.href;
		},
		"visited": function(element) {
			return element.nodeName.toLowerCase() === "a" && element.href && element.visited;
		},
		"active": function(element) {
			return element === element.activeElement;
		},
		"hover": function(element) {
			return element === element.hoverElement;
		},
		"focus": function(element) {
			return element === element.activeElement && element.hasFocus() && (element.type || element.href);
		},
		"target": function(element) {
			var hash = document.location ? document.location : "";
			return element.id && element.id === hash.substring(1);
		},
		"lang": function(element, parameter) {
			var lang = parameter.toLowerCase(),
				current = element,
				result = false;
			while (current.parentNode !== document) {
				if (current.lang.toLowerCase() === lang) {
					result = true;
					break;
				}
				current = current.parentNode;
			}
			return result;
		},
		"enabled": function(element) {
			return element.disabled === false && element.type !== "hidden";
		},
		"disabled": function(element) {
			return element.disabled === true;
		},
		"checked": function(element) {
			return element.checked === true;
		},
		"not": function(element, parameter) {
			return !isMatchedByCompoundSelector(element, parseCompoundSelector(parameter));
		}
	};
	/**
	 * Determine whether a specified element is descendant of another specified element.
	 * 
	 * @param {Element} descendant
	 * @param {Element} element
	 */
	function isDescendantOf(descendant, element) {
		var current = descendant.parentNode, isDescendant = false;
		while ((current = current.parentNode) !== null) {
			if (current === element) {
				isDescendant = true;
				break;
			}
		}
		return isDescendant;
	}
	/**
	 * Determine whether a specified element matches a specified parsed compound selector.
	 * 
	 * @param {Element} element
	 * @param {Object} compoundSelector
	 * @returns {Boolean}
	 */
	function isMatchedByCompoundSelector(element, compoundSelector) {
		var isMatched = true;
		if (compoundSelector.idSelector && compoundSelector.idSelector !== element.id) {
			isMatched = false;
		}
		if (isMatched && compoundSelector.typeSelector !== "*" && compoundSelector.typeSelector.toLowerCase() !== element.nodeName.toLowerCase()) {
			isMatched = false;
		}
		if (isMatched) {
			each(compoundSelector.attributeSelectors, function(attribute) {
				if (!isMatchedByAttributeSelector[attribute.operator](element, attribute.attribute, attribute.value)) {
					isMatched = false;
					return false;
				}
			});
		}
		if (isMatched) {
			each(compoundSelector.pseudoSelectors, function(pseudo) {
				if (!isMatchedByPseudoSelector[pseudo.name](element, pseudo.parameter, compoundSelector.typeSelector)) {
					isMatched = false;
					return false;
				}
			});
		}
		return isMatched;
	}
	/**
	 * Determine whether a specified element matches a specified parsed complex selector(WITHOUT the last compound selector).
	 * 
	 * @param {Element} element
	 * @param {Object} complexSelector
	 * @returns {Boolean}
	 */
	function isMatchedByComplexSelector(element, complexSelector) {
		var current = element, // Marks the current element.
			isMatched = true;
		
		each(complexSelector.compoundSelectors, function(compoundSelector, index) {
			switch (complexSelector.combinators[index]) {
				case " ":
					while ((current = current.parentNode) !== document) {
						if (isMatchedByCompoundSelector(current, compoundSelector)) {
							break;
						}
					}
					if (current === document) {
						isMatched = false;
					}
					break;
				case ">":
					current = current.parentNode;
					if (current === null || !isMatchedByCompoundSelector(current, compoundSelector)) {
						isMatched = false;
					}
					break;
				case "+":
					while ((current = current.previousSibling) !== null && current.nodeType !== 1) { // ELEMENT_NODE
						// Traverse to the previous element sibling
					}
					if (current === null || !isMatchedByCompoundSelector(current, compoundSelector)) {
						isMatched = false;
					}
					break;
				case "~":
					while ((current = current.previousSibling) !== null && current.nodeType !== 1) { // ELEMENT_NODE
						if (current.nodeType === 1 && !isMatchedByCompoundSelector(current, compoundSelector)) {
							isMatched = false;
						}
					}
					if (current === null) {
						isMatched = false;
					}
					break;
			}
			if (!isMatched) {
				return false; // Ends the loop.
			}
		}, true); // Loops in reversed order.
		return isMatched;
	}
	/**
	 * Parses the specified selectors in a specified context or the current document, and retuns an array of matched DOMElements.
	 * 
	 * A selector is a chain of one or more sequences of simple selectors separated by combinators. One pseudo-element may be appended to the last sequence of simple selectors in a selector. A sequence of simple selectors is a chain of
	 * simple selectors that are not separated by a combinator. It always begins with a type selector or a universal selector. No other type selector or universal selector is allowed in the sequence. A simple selector is either a type
	 * selector, universal selector, attribute selector, class selector, ID selector, or pseudo-class. Combinators are: whitespace, "greater-than sign" (U+003E, >), "plus sign" (U+002B, +) and "tilde" (U+007E, ~). White space may appear
	 * between a combinator and the simple selectors around it. Only the characters "space" (U+0020), "tab" (U+0009), "line feed" (U+000A), "carriage return" (U+000D), and "form feed" (U+000C) can occur in whitespace. Other space-like
	 * characters, such as "em-space" (U+2003) and "ideographic space" (U+3000), are never part of whitespace.
	 * 
	 * Note: If you wish to use any of the meta-characters(such as !"#$%&'()*+,./:;<=>?@[\]^`{|}~) as a literal part of a name, you must escape the character with two backslashes: \\.
	 * 
	 * Demo: selectors -> "body div.header, body div.footer" selector -> "body div.header" type selector -> "body" universal selector -> "*" attribute selector -> "[foo='bar']" class selector -> ".header" ID selector -> "#header"
	 * pseudo-class -> ":nth-child(2n)"
	 * 
	 * Queries DOMElements using specified selectors and context, and retuns an array of matched DOMElements.
	 * 
	 * @param {String} selector
	 * @param {Element|String|Array} context
	 * @return {Array}
	 */
	function find(selector, context) {
		var parsedSelectors = parseSelector(selector),
			contexts = [document],
			matchedElements = [];  // Elements found

		if (context !== undefined) {
			if (context.nodeType === 1) {  // Element
				contexts = [context];
			} else if (typeof context === "string"){
				contexts = find(context);
			} else if (context.length !== undefined){
				contexts = context;
			}
		}
		
		// Iterate over each complex selector
		each(parsedSelectors, function (parsedSelector) {
			// Pop the last compound selector.
			var lastCompoundSelector = parsedSelector.compoundSelectors.pop();
			// Iterate over each context
			each(contexts, function (context) {
				var elementsToBeFiltered = [];
				// Retrieve all candidate elements by the right most compound selector of each complex selector.
				if (lastCompoundSelector.idSelector) {
					element = document.getElementById(lastCompoundSelector.idSelector);
					lastCompoundSelector.idSelector = null;
					if (isMatchedByCompoundSelector(element, lastCompoundSelector) && isDescendantOf(element, context)) {
						elementsToBeFiltered.push(element);
					}
				} else {
					each(convertToArray(context.getElementsByTagName(lastCompoundSelector.typeSelector)), function (element) {
						if (isMatchedByCompoundSelector(element, lastCompoundSelector)) {
							elementsToBeFiltered.push(element);
						}
					});
				}
				// Filter all candidate elements
				each(elementsToBeFiltered, function(element, index) {
					if (element !== null && !isMatchedByComplexSelector(element, parsedSelector)) {
						elementsToBeFiltered[index] = null;
					}
				});
				// Add elements matched in current context to the result collection
				each(elementsToBeFiltered, function(element) {
					if (element !== null) {
						matchedElements.push(element);
					}
				});
			});
		});
		return matchedElements;
	}
	/**
	 * Create a document fragment containing the node hierarchy of specified selector.
	 * 
	 * @param {Selector} selector
	 * @returns {DocumentFragment}
	 */
	function create(selector) {
		var fragment = document.createDocumentFragment();
		if (/^\w+$/.test(selector)) {
			fragment.appendChild(document.createElement(selector));
		} else {
			throw new Error("Not Implemented.");
		}
		return fragment;
	}
	/**
	 * Determine whether an element matches a specified selector in a specific context.
	 * 
	 * @param {Element} element
	 * @param {String} selector
	 * @param {Element|String|Array} context
	 * @return {Boolean}
	 */
	function match(element, selector, context) {
		var contexts = [document], isMatched = false;

		if (context !== undefined) {
			if (context.nodeType === 1) {  // Element
				contexts = [context];
			} else if (typeof context === "string"){
				contexts = find(context);
			} else if (context.length !== undefined){
				contexts = context;
			}
		}
	
		each(parseSelector(selector), function (parsedSelector) {
			each(contexts, function (context) {
				if (isMatchedByComplexSelector(element, parsedSelector)) {
					isMatched = true;
					return false;  // Break current each
				}
			});
			if (isMatched) {
				return false;  // Break current each
			}
		});
		return isMatched;
	}
	/**
	 * Expose to global.
	 */
	window.Selector = {
		find: find,
		create: create,
		match: match
	};
})(this);