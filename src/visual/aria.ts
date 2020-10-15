/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

// @ts-nocheck

import * as zrUtil from 'zrender/src/core/util';
import ExtensionAPI from '../ExtensionAPI';
import {retrieveRawValue} from '../data/helper/dataProvider';
import GlobalModel from '../model/Global';
import Model from '../model/Model';
import {AriaOption} from '../component/aria';

export default function (ecModel: GlobalModel, api: ExtensionAPI) {
    const ariaModel: Model<AriaOption> = ecModel.getModel('aria');
    if (!ariaModel.get('show')) {
        return;
    }

    setDecal();
    setLabel();

    function setDecal() {
        const decalModel = ariaModel.getModel('decal');

        const useDecal = !decalModel || (decalModel.get('show') !== false);
        if (useDecal) {
            // default decal show value is true
            ecModel.eachRawSeries(seriesModel => {
                const data = seriesModel.getData();

                if (seriesModel.useColorPaletteOnData) {
                    const dataCount = data.count();
                    data.each(idx => {
                        const itemStyle = data.ensureUniqueItemVisual(idx, 'style');
                        const name = data.getName(idx) || (idx + '');
                        const paletteDecal = seriesModel.getDecalFromPalette(
                            name,
                            null,
                            dataCount
                        );
                        const decal = zrUtil.defaults(
                            itemStyle.decal || {},
                            paletteDecal
                        );
                        data.setItemVisual(idx, 'decal', decal);
                    });
                }
                else {
                    const style = data.getVisual('style');
                    const paletteDecal = seriesModel.getDecalFromPalette(
                        seriesModel.name,
                        null,
                        ecModel.getSeriesCount()
                    );
                    const decal = zrUtil.defaults(
                        style.decal || {},
                        paletteDecal
                    );
                    data.setVisual('decal', decal);
                }
            });
        }
    }

    function setLabel() {
        const labelModel = ariaModel.getModel('label') || ariaModel;
        const dom = api.getZr().dom;
        if (labelModel.get('description')) {
            dom.setAttribute('aria-label', labelModel.get('description'));
            return;
        }

        const seriesCnt = ecModel.getSeriesCount();
        const maxDataCnt = labelModel.get('data.maxCount') || 10;
        const maxSeriesCnt = labelModel.get('series.maxCount') || 10;
        const displaySeriesCnt = Math.min(seriesCnt, maxSeriesCnt);

        let ariaLabel;
        if (seriesCnt < 1) {
            // No series, no aria label
            return;
        }
        else {
            const title = getTitle();
            if (title) {
                ariaLabel = replace(getConfig(labelModel, 'general.withTitle'), {
                    title: title
                });
            }
            else {
                ariaLabel = getConfig(labelModel, 'general.withoutTitle');
            }

            const seriesLabels = [];
            const prefix = seriesCnt > 1
                ? 'series.multiple.prefix'
                : 'series.single.prefix';
            ariaLabel += replace(getConfig(labelModel, prefix), { seriesCount: seriesCnt });

            ecModel.eachSeries(function (seriesModel, idx) {
                if (idx < displaySeriesCnt) {
                    let seriesLabel;

                    const seriesName = seriesModel.get('name');
                    const seriesTpl = 'series.'
                        + (seriesCnt > 1 ? 'multiple' : 'single') + '.';
                    seriesLabel = getConfig(labelModel, seriesName
                        ? seriesTpl + 'withName'
                        : seriesTpl + 'withoutName');

                    seriesLabel = replace(seriesLabel, {
                        seriesId: seriesModel.seriesIndex,
                        seriesName: seriesModel.get('name'),
                        seriesType: getSeriesTypeName(seriesModel.subType)
                    });

                    const data = seriesModel.getData();
                    window.data = data;
                    if (data.count() > maxDataCnt) {
                        // Show part of data
                        seriesLabel += replace(getConfig(labelModel, 'data.partialData'), {
                            displayCnt: maxDataCnt
                        });
                    }
                    else {
                        seriesLabel += getConfig(labelModel, 'data.allData');
                    }

                    const dataLabels = [];
                    for (let i = 0; i < data.count(); i++) {
                        if (i < maxDataCnt) {
                            const name = data.getName(i);
                            const value = retrieveRawValue(data, i);
                            dataLabels.push(
                                replace(
                                    name
                                        ? getConfig(labelModel, 'data.withName')
                                        : getConfig(labelModel, 'data.withoutName'),
                                    {
                                        name: name,
                                        value: value
                                    }
                                )
                            );
                        }
                    }
                    seriesLabel += dataLabels
                        .join(getConfig(labelModel, 'data.separator.middle'))
                        + getConfig(labelModel, 'data.separator.end');

                    seriesLabels.push(seriesLabel);
                }
            });

            ariaLabel += seriesLabels
                .join(getConfig(labelModel, 'series.multiple.separator.middle'))
                + getConfig(labelModel, 'series.multiple.separator.end');

            dom.setAttribute('aria-label', ariaLabel);
        }
    }

    function replace(str, keyValues) {
        if (typeof str !== 'string') {
            return str;
        }

        let result = str;
        zrUtil.each(keyValues, function (value, key) {
            result = result.replace(
                new RegExp('\\{\\s*' + key + '\\s*\\}', 'g'),
                value
            );
        });
        return result;
    }

    function getConfig(model, path) {
        const userConfig = model.get(path);
        if (userConfig == null) {
            const pathArr = path.split('.');
            let result = ecModel.getLocale('aria');
            for (let i = 0; i < pathArr.length; ++i) {
                result = result[pathArr[i]];
            }
            return result;
        }
        else {
            return userConfig;
        }
    }

    function getTitle() {
        let title = ecModel.getModel('title').option;
        if (title && title.length) {
            title = title[0];
        }
        return title && title.text;
    }

    function getSeriesTypeName(type) {
        return ecModel.getLocale(['series', 'typeNames'])[type] || '自定义图';
    }
}
