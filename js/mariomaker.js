(function() {
	function searchInElement(element) {
		for (var i = 0; i < element.childNodes.length; i++) {
			var child = element.childNodes[i];
			if (child.nodeType == Node.ELEMENT_NODE) {
				var tag = child.nodeName.toLowerCase();
				if (tag == 'a') {
					searchInLink(child);
				} else if (tag != 'style' && tag != 'script' ) // special cases, don't touch CDATA elements
					searchInElement(child);
			} else if (child.nodeType == Node.TEXT_NODE) {
				searchInText(child);
			}
		}
	}
	function searchInText(text) {
		var match;
		var matches = [];
		idRegex.lastIndex = 0; //Reset the regex object
		while ((match = idRegex.exec(text.data)) !== null) {
			matches.push(match);
		}

		function generateCallback(match, text) {
			return function(courseInfo) {
				if (courseInfo !== undefined) {
					insertLink(courseInfo, match, text);
					insertButton(courseInfo, text.nextSibling);
				}
			};
		}

		for (var i = 0; i < matches.length; i++) {
			var id = normalizeCourseId(matches[i][0]);
			getCourseInfo(id, generateCallback(matches[i], text));
		}
	}

	function searchInLink(link) {
		function generateCallback(link) {
			return function(courseInfo) {
				if (courseInfo !== undefined) {
					insertButton(courseInfo, link);
				}
			};
		}

		linkRegex.lastIndex = 0; //Reset the regex object
		var match = linkRegex.exec(link.href);
		if (match !== null) {
			var id = normalizeCourseId(match[1]);
			getCourseInfo(id, generateCallback(link));
		}
	}

	function getCourseInfo(id, callback) {
		if (courseInfoCache[id] !== undefined) {
			callback(courseInfoCache[id]);
		}
		else if (courseInfoCallbacks[id] !== undefined) {
			courseInfoCallbacks[id].push(callback);
		} else {
			courseInfoCallbacks[id] = [callback];

			var request = new XMLHttpRequest();

			request.onreadystatechange = function() {
				if (request.readyState == XMLHttpRequest.DONE) {
					if (request.status == 200) {
						var parser = new DOMParser();
						var doc = parser.parseFromString(request.responseText, "text/html");

						var metas = doc.getElementsByTagName("meta");
						var token = null;
						for (var i = 0; i < metas.length; i++) {
							if (metas[i].getAttribute("name") == "csrf-token") {
								token = metas[i].getAttribute("content");
							}
						}

						var bookmarkbutton = doc.getElementsByClassName("button playlist link off")[0];
						var isBookmarked = true;
						if (bookmarkbutton.classList.contains("disabled")) {
							isBookmarked = false;
						}

						if (token !== null) {
							var courseInfo = {
								id: id,
								isBookmarked: isBookmarked,
								token: token
							};
							courseInfoCache[id] = courseInfo;
							for (i = 0; i < courseInfoCallbacks[id].length; i++) {
								courseInfoCallbacks[id][i](courseInfo);
							}
						}
					}
				}
			};
			request.open("GET", "https://supermariomakerbookmark.nintendo.net/courses/"+id);
			request.withCredentials = true;
			request.send();
		}
	}

	function normalizeCourseId(string) {
		return string.replace(/ /g, '-').toUpperCase();
	}

	function insertLink(courseInfo, match, text) {
		var link = document.createElement('a');
		link.href = 'https://supermariomakerbookmark.nintendo.net/courses/'+courseInfo.id;
		link.appendChild(document.createTextNode(match[0]));
		text.splitText(match.index);
		text.nextSibling.splitText(match[0].length);
		text.parentNode.replaceChild(link, text.nextSibling);

	}

	function insertButton(courseInfo, text) {
		var directbookmark = document.createElement('a');
		directbookmark.href = "";
		if (courseInfo.isBookmarked) {
			directbookmark.onclick = function(event) {
				setBookmark(courseInfo.id, courseInfo.token, event.target);
				return false;
			};
			imageSrc = imageBookmark;
		}
		else {
			directbookmark.onclick = function(event) {
				unsetBookmark(courseInfo.id, courseInfo.token, event.target);
				return false;
			};
			imageSrc = imageUnbookmark;
		}
		directbookmarkimage = document.createElement('img');
		directbookmarkimage.setAttribute('src', imageSrc);
		directbookmarkimage.className = "marioMakerDirectBookmark";
		directbookmark.appendChild(directbookmarkimage);

		text.parentNode.insertBefore(directbookmark, text.nextSibling);
	}

	function setBookmark(id, token, button) {
		var request = new XMLHttpRequest();

		request.onreadystatechange = function() {
			if (request.readyState == XMLHttpRequest.DONE) {
				if (request.status == 200) {
					button.setAttribute('src', imageUnbookmark);
					button.parentElement.onclick = function(event) {
						unsetBookmark(id, token, event.target);
						return false;
					};
				}
				else {
					alert("Error. Please make sure that you are logged in on supermariomakerbookmark.nintendo.net");
					button.setAttribute('src', imageBookmark);
					button.parentElement.onclick = function(event) {
						setBookmark(id, token, event.target);
						return false;
					};

				}
			}
		};

		request.open('POST', "https://supermariomakerbookmark.nintendo.net/courses/"+id+"/play_at_later");
		request.setRequestHeader("Accept", "application/json");
		request.setRequestHeader("X-Requested-With", "XMLHttpRequest");
		request.setRequestHeader("X-CSRF-Token", token);
		request.setRequestHeader("Referer", "https://supermariomakerbookmark.nintendo.net/courses/"+id);
		request.withCredentials = true;
		button.setAttribute('src', imageLoading);
		button.parentElement.onclick = doNothing;
		request.send();
	}

	function unsetBookmark(id, token, button) {
		var request = new XMLHttpRequest();

		request.onreadystatechange = function() {
			if (request.readyState == XMLHttpRequest.DONE) {
				if (request.status == 200) {
					button.setAttribute('src', imageBookmark);
					button.parentElement.onclick = function(event) {
						setBookmark(id, token, event.target);
						return false;
					};
				}
				else {
					alert("Error. Please make sure that you are logged in on supermariomakerbookmark.nintendo.net");
					button.setAttribute('src', imageUnBookmark);
					button.parentElement.onclick = function(event) {
						unsetBookmark(id, token, event.target);
						return false;
					};

				}
			}
		};

		request.open('DELETE', "https://supermariomakerbookmark.nintendo.net/bookmarks/"+id);
		request.setRequestHeader("Accept", "application/json");
		request.setRequestHeader("X-Requested-With", "XMLHttpRequest");
		request.setRequestHeader("X-CSRF-Token", token);
		request.setRequestHeader("Referer", "https://supermariomakerbookmark.nintendo.net/courses/"+id);
		request.withCredentials = true;
		button.setAttribute('src', imageLoading);
		button.parentElement.onclick = doNothing;
		request.send();
	}

	function doNothing() { //What? This way I don't have to recreate the function all the time.
		return false;
	}

	function onDOMChange(mutations) {
		mutations.forEach(function(mutation) {
			for (var i = 0; i < mutation.addedNodes.length; i++) {
				node = mutation.addedNodes[i];
				if (node.parentNode.nextSibling === null || !node.parentNode.nextSibling.classList.contains("marioMakerDirectBookmark")) {
					if (node.nodeType == Node.ELEMENT_NODE) {
						var tag = node.nodeName.toLowerCase();
						if (tag == 'a') {
							searchInLink(node);
						}
						else if (tag != 'style' && tag != 'script' ) // special cases, don't touch CDATA elements
							searchInElement(node);
					} else if (node.nodeType == Node.TEXT_NODE) {
						searchInText(node);
					}
				}
			}
		});
	}

	//Base64 encoded images to prevent dealing with browser specific resource loading
	var imageBookmark = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3wwWEgEDAI72/QAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAQElEQVQ4y2P8//8/AyWACZ+k3EbG/3IbGf+TbQDFLhghBjD+//+fgVBI4wKP/P8zUscF+NIBzKbRaKR1OqAEAACkzxevPUlGPgAAAABJRU5ErkJggg==';
	var imageUnbookmark = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3wwWEgIEtccwnQAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAASklEQVQ4y2P8//8/AyWACZ+k3EZGBrmNjOQbQLELhoYBjPhi4R0PD5wt9OULbgPe8fCQFZdCX74w0tYLsDTwyP//aDoYsIREDAAAcYEarSA1+NcAAAAASUVORK5CYII=';
	var imageLoading = 'data:image/gif;base64,R0lGODlhEAAQAMIAAP+EAP+ICP+ICf////+EAP+EAP+EAP+EACH/C05FVFNDQVBFMi4wAwEAAAAh/hFDcmVhdGVkIHdpdGggR0lNUAAh+QQFCgAEACwAAAAAEAAQAAADIji63L7hPQCkqg5bRrf/kKeJQASOYNN91HpN7QII6IXWaQIAIfkEBQoABwAsAQACAA0ADQAAAyQ4urwHoC3wYJTK0sN7h154YM1IOifziCEgXA34MJsXQ+kQSAkAIfkEBQoABwAsAQABAA0ADQAAAyR4CtMNQC0RF4yuWnicf9UnNsroBZBJMuogvXDXeunMftgXHwkAIfkEBQoABwAsAgABAA0ADQAAAyI4urHuIL5DK4BUvgEEqCD4beRBTqcThtEqRtcJf/HWpk4CADs=';


	var idRegex = /(?:[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}|[0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4} [0-9a-f]{4})/gi;
	var linkRegex = /[Hh][Tt][Tt][Pp][Ss]?:\/\/[Ss][Uu][Pp][Ee][Rr][Mm][Aa][Rr][Ii][Oo][Mm][Aa][Kk][Ee][Rr][Bb][Oo][Oo][Kk][Mm][Aa][Rr][Kk].[Nn][Ii][Nn][Tt][Ee][Nn][Dd][Oo].[Nn][Ee][Tt]\/courses\/([0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})/g; //Sorry ._. Only way to make regex partually case insensitive

	var courseInfoCache = [];
	var courseInfoCallbacks = [];

	searchInElement(document.body);

	var observer = new MutationObserver(onDOMChange);
	var config = {childList: true, subtree: true};
	observer.observe(document.body, config);

})();
