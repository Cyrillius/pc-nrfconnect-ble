/* Copyright (c) 2016 Nordic Semiconductor. All Rights Reserved.
 *
 * The information contained herein is property of Nordic Semiconductor ASA.
 * Terms and conditions of usage are described in detail in NORDIC
 * SEMICONDUCTOR STANDARD SOFTWARE LICENSE AGREEMENT.
 *
 * Licensees are granted free, non-transferable use of the information. NO
 * WARRANTY of ANY KIND is provided. This heading must NOT be removed from
 * the file.
 *
 */

'use strict';

import Immutable, { Record, OrderedMap, List } from 'immutable';
import * as DiscoveryAction from '../actions/discoveryActions';
import * as AdapterAction from '../actions/adapterActions';
import * as apiHelper from '../utils/api';
import { logger } from '../logging';

const DiscoveryOptions = Record({
    expanded: false,
    sortByRssi: false,
    filterString: '',
    scanInterval: 100,
    scanWindow: 20,
    scanTimeout: 60,
    activeScan: true,
});

const InitialState = Record({
    devices: OrderedMap(),
    errors: List(),
    options: new DiscoveryOptions(),
});

const initialState = new InitialState();

function scanStarted(state) {
    logger.info('Scan started');
    return state;
}

function scanStopped(state) {
    logger.info('Scan stopped');
    return state;
}

function deviceDiscovered(state, device) {
    let newDevice = apiHelper.getImmutableDevice(device);
    const existingDevice = state.devices.get(device.address);

    // Keep exising name if new name is empty
    if (existingDevice && existingDevice.name !== '' && device.name === '') {
        newDevice = newDevice.setIn(['name'], existingDevice.name);
    }

    // Keep existing list of services if new list is empty
    if (existingDevice && existingDevice.services.size > 0 && device.services.length === 0) {
        newDevice = newDevice.setIn(['services'], existingDevice.services);
    }

    if (existingDevice) {
        newDevice = newDevice.setIn(['isExpanded'], existingDevice.isExpanded);
        newDevice = newDevice.mergeIn(['adData'], existingDevice.adData);
    }

    state = state.setIn(['devices', device.address], newDevice);

    state = applyFilters(state);

    return state;
}

function applyFilters(state) {
    if (state.options.filterString) {
        const filteredDevices = state.devices.filter(device => {
            if (device.name.search(new RegExp(state.options.filterString, 'i')) >= 0) return true;
            else if (device.address.search(new RegExp(state.options.filterString, 'i')) >= 0) return true;
            else return false;
        });
        state = state.set('devices', filteredDevices);
    }

    if (state.options.sortByRssi) {
        const orderedDevices = state.devices.sort((dev1, dev2) => {
            if (dev1.rssi < dev2.rssi) return 1;
            else if (dev1.rssi > dev2.rssi) return -1;
            else return 0;
        });
        state = state.set('devices', orderedDevices);
    }

    return state;
}

function addError(state, error) {
    return state.set('errors', state.errors.push(error));
}

function clearList(state) {
    return state.set('devices', state.devices.clear());
}

function deviceConnect(state, device) {
    if (state.devices.get(device.address)) {
        return state.setIn(['devices', device.address, 'isConnecting'], true);
    }
    return state;
}

function deviceConnected(state, device) {
    if (state.devices.get(device.address)) {
        state = state.setIn(['devices', device.address, 'isConnecting'], false);
        return state.setIn(['devices', device.address, 'connected'], true);
    }
    return state;
}

function deviceDisconnected(state, device) {
    if (state.devices.get(device.address)) {
        return state.setIn(['devices', device.address, 'connected'], false);
    }
    return state;
}

function deviceConnectTimeout(state, deviceAddress) {
    logger.info(`Connection to device timed out`);
    return state.setIn(['devices', deviceAddress.address, 'isConnecting'], false);
}

function deviceCancelConnect(state) {
    const newDevices = state.devices.map(device => device.set('isConnecting', false));
    return state.set('devices', newDevices);
}

function toggleExpanded(state, deviceAddress) {
    return state.updateIn(['devices', deviceAddress, 'isExpanded'], value => !value);
}

function toggleOptionsExpanded(state) {
    return state.updateIn(['options', 'expanded'], value => !value);
}

function discoverySetOptions(state, options) {
    state = state.set('options', new DiscoveryOptions(options));
    return applyFilters(state);
}

export default function discovery(state = initialState, action) {
    switch (action.type) {
        case DiscoveryAction.DISCOVERY_CLEAR_LIST:
            return clearList(state);
        case DiscoveryAction.ERROR_OCCURED:
            return addError(state, action.error);
        case DiscoveryAction.DISCOVERY_SCAN_STARTED:
            return scanStarted(state);
        case DiscoveryAction.DISCOVERY_SCAN_STOPPED:
            return scanStopped(state);
        case DiscoveryAction.DISCOVERY_TOGGLE_EXPANDED:
            return toggleExpanded(state, action.deviceAddress);
        case DiscoveryAction.DISCOVERY_TOGGLE_OPTIONS_EXPANDED:
            return toggleOptionsExpanded(state);
        case DiscoveryAction.DISCOVERY_SET_OPTIONS:
            return discoverySetOptions(state, action.options);
        case AdapterAction.DEVICE_DISCOVERED:
            return deviceDiscovered(state, action.device);
        case AdapterAction.DEVICE_CONNECT:
            return deviceConnect(state, action.device);
        case AdapterAction.DEVICE_CONNECTED:
            return deviceConnected(state, action.device);
        case AdapterAction.DEVICE_DISCONNECTED:
            return deviceDisconnected(state, action.device);
        case AdapterAction.DEVICE_CONNECT_TIMEOUT:
            return deviceConnectTimeout(state, action.deviceAddress);
        case AdapterAction.DEVICE_CANCEL_CONNECT:
            return deviceCancelConnect(state);
        case AdapterAction.ADAPTER_RESET_PERFORMED:
            return initialState;
        case AdapterAction.ADAPTER_CLOSED:
            return initialState;
        default:
            return state;
    }
}
