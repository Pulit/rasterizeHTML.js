var document2svg = (function (util, browser, documentHelper, xmlserializer) {
    "use strict";

    var module = {};

    var svgAttributes = function (size, zoom) {
        var zoomFactor = zoom || 1;

        var attributes = {
            width: size.width,
            height: size.height,
            "font-size": size.rootFontSize,
        };

        if (zoomFactor !== 1) {
            attributes.style =
                "transform:scale(" + zoomFactor + "); transform-origin: 0 0;";
        }

        return attributes;
    };

    var foreignObjectAttributes = function (size) {
        var closestScaledWith, closestScaledHeight, offsetX, offsetY;

        closestScaledWith = Math.round(size.viewportWidth);
        closestScaledHeight = Math.round(size.viewportHeight);

        offsetX = -size.left;
        offsetY = -size.top;

        var attributes = {
            x: offsetX,
            y: offsetY,
            width: closestScaledWith,
            height: closestScaledHeight,
        };

        return attributes;
    };

    var workAroundCollapsingMarginsAcrossSVGElementInWebKitLike = function (
        attributes
    ) {
        var style = attributes.style || "";
        attributes.style = style + "float: left;";
    };

    var workAroundSafariSometimesNotShowingExternalResources = function (
        attributes
    ) {
        /* Let's hope that works some magic. The spec says SVGLoad only fires
         * now when all externals are available.
         * http://www.w3.org/TR/SVG/struct.html#ExternalResourcesRequired */
        attributes.externalResourcesRequired = true;
    };

    var workAroundChromeShowingScrollbarsUnderLinuxIfHtmlIsOverflowScroll =
        function () {
            return '<style scoped="">html::-webkit-scrollbar { display: none; }</style>';
        };

    var serializeAttributes = function (attributes) {
        var keys = Object.keys(attributes);
        if (!keys.length) {
            return "";
        }

        return (
            " " +
            keys
                .map(function (key) {
                    return key + '="' + attributes[key] + '"';
                })
                .join(" ")
        );
    };

    var convertElementToSvg = function (element, size, zoomFactor) {
        try {
            var customDefinedFontData = window.customDefinedFontData;
            if (customDefinedFontData && customDefinedFontData.get) {
                var customFontList = customDefinedFontData.get();
                var styleList = element.querySelectorAll("style");
                for (var i = 0; i < styleList.length; i++) {
                    var styleTag = styleList[i];
                    var html = styleTag.innerHTML;
                    if (html && html.indexOf("font-family:") >= 0) {
                        var fontName = /font-family:\s*['"]?([^;]+)['"]?;/.exec(
                            html
                        )[1];
                        if (
                            fontName.startsWith("'") ||
                            fontName.startsWith('"')
                        ) {
                            fontName = fontName.substring(1);
                        }
                        if (fontName.endsWith("'") || fontName.endsWith('"')) {
                            fontName = fontName.substring(
                                0,
                                fontName.length - 1
                            );
                        }
                        for (var j = 0; j < customFontList.length; j++) {
                            var font = customFontList[j];
                            if (font.name === fontName && font.dataURL) {
                                styleTag.innerHTML = html.replace(
                                    /url\(["']blob:[^)]+["']\)/,
                                    "url(\"" + font.dataURL + "\")"
                                );
                                break;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            window.console.error(e);
        }

        var xhtml = xmlserializer.serializeToString(element);

        browser.validateXHTML(xhtml);

        var foreignObjectAttrs = foreignObjectAttributes(size);
        workAroundCollapsingMarginsAcrossSVGElementInWebKitLike(
            foreignObjectAttrs
        );
        workAroundSafariSometimesNotShowingExternalResources(
            foreignObjectAttrs
        );

        return (
            '<svg xmlns="http://www.w3.org/2000/svg"' +
            serializeAttributes(svgAttributes(size, zoomFactor)) +
            ">" +
            workAroundChromeShowingScrollbarsUnderLinuxIfHtmlIsOverflowScroll() +
            "<foreignObject" +
            serializeAttributes(foreignObjectAttrs) +
            ">" +
            xhtml +
            "</foreignObject>" +
            "</svg>"
        );
    };

    module.getSvgForDocument = function (element, size, zoomFactor) {
        documentHelper.rewriteTagNameSelectorsToLowerCase(element);

        return convertElementToSvg(element, size, zoomFactor);
    };

    module.drawDocumentAsSvg = function (element, options) {
        ["hover", "active", "focus", "target"].forEach(function (action) {
            if (options[action]) {
                documentHelper.fakeUserAction(element, options[action], action);
            }
        });

        try {
            var customDefinedFontData = window.customDefinedFontData;
            if (customDefinedFontData && customDefinedFontData.get) {
                var customFontList = customDefinedFontData.get();
                var styleList = element.querySelectorAll("style");
                for (var i = 0; i < styleList.length; i++) {
                    var styleTag = styleList[i];
                    var html = styleTag.innerHTML;
                    if (html && html.indexOf("font-family:") >= 0) {
                        var fontName = /font-family:\s*['"]?([^;]+)['"]?;/.exec(
                            html
                        )[1];
                        if (
                            fontName.startsWith("'") ||
                            fontName.startsWith('"')
                        ) {
                            fontName = fontName.substring(1);
                        }
                        if (fontName.endsWith("'") || fontName.endsWith('"')) {
                            fontName = fontName.substring(
                                0,
                                fontName.length - 1
                            );
                        }
                        for (var j = 0; j < customFontList.length; j++) {
                            var font = customFontList[j];
                            if (font.name === fontName && font.fontFile && font.fontFile.fileURL && font.dataURL) {
                                styleTag.innerHTML = html.replace(
                                    /url\(["']data:font[^)]+["']\)/,
                                    "url(\"" + font.fontFile.fileURL + "\")"
                                );
                                break;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            window.console.error(e);
        }

        return browser
            .calculateDocumentContentSize(element, options)
            .then(function (size) {
                return module.getSvgForDocument(element, size, options.zoom);
            });
    };

    return module;
})(util, browser, documentHelper, xmlserializer);
