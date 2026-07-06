import 'dart:ui_web' as ui_web;
import 'dart:html' as html;
import 'package:flutter/material.dart';

void registerBlurMaskViewFactories() {
  for (int i = 0; i < 10; i++) {
    ui_web.platformViewRegistry.registerViewFactory(
      'blur-mask-view-$i',
      (int viewId) {
        return html.DivElement()
          ..className = 'blur-mask-html'
          ..setAttribute('data-index', '$i')
          ..style.width = '100%'
          ..style.height = '100%'
          ..style.position = 'absolute'
          ..style.top = '0'
          ..style.left = '0'
          ..style.right = '0'
          ..style.bottom = '0'
          ..style.pointerEvents = 'none';
      },
    );
  }
}

Color _colorFromHex(String hexColor) {
  final hex = hexColor.replaceAll('#', '');
  if (hex.length == 6) {
    return Color(int.parse('FF$hex', radix: 16));
  } else if (hex.length == 8) {
    return Color(int.parse(hex, radix: 16));
  }
  return Colors.black;
}

void updateBlurMaskStyles(
  int index,
  double blurRadius,
  String colorHex,
  double opacity,
) {
  final elements = html.document.getElementsByClassName('blur-mask-html');
  for (var node in elements) {
    if (node is html.Element) {
      final indexStr = node.getAttribute('data-index');
      if (indexStr == '$index') {
        final div = node as html.DivElement;
        
        // Set blur filters using setProperty to bypass CssStyleDeclaration missing setters
        div.style.setProperty('backdrop-filter', 'blur(${blurRadius}px) brightness(1.0)');
        div.style.setProperty('-webkit-backdrop-filter', 'blur(${blurRadius}px) brightness(1.0)');
        
        // Set mask-image for feathering the top/bottom edges smoothly
        div.style.setProperty('mask-image', 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)');
        div.style.setProperty('-webkit-mask-image', 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)');
        
        // Convert colorHex and opacity to rgba, avoiding deprecated getters
        final Color color = _colorFromHex(colorHex);
        final r = (color.r * 255.0).round();
        final g = (color.g * 255.0).round();
        final b = (color.b * 255.0).round();
        div.style.setProperty('background-color', 'rgba($r, $g, $b, $opacity)');
      }
    }
  }
}

