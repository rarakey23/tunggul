var menuStyle = {
  menu: 'context_menu',
  menuSeparator: 'context_menu_separator'
};
var contextMenuOptions = {
  classNames: menuStyle,
  menuItems: [
    {
      label: 'I am here', id: 'menu_option1',
      className: 'menu_item', eventName: 'option1_clicked'
    }
  ],
  pixelOffset: new google.maps.Point(0, 0),
  zIndex: 5
};
var contextMenu = new ContextMenu(map, contextMenuOptions);
google.maps.event.addListener(contextMenu, 'menu_item_selected',
  function (latLng, eventName, source) {
    switch (eventName) {

      case 'option1_clicked':
        console.log(latLng);
        setLocationNow(latLng.lat(), latLng.lng());
        break;
      default:
        console.log('default_clicked');
        // freak out
        break;
    }
  });
google.maps.event.addListener(map, 'rightclick', function (mouseEvent) {
  contextMenu.show(mouseEvent.latLng, map);
});

